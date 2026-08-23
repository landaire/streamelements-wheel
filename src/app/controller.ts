import type { WidgetLoadDetail, EventReceivedDetail, ChatEventData } from "../se/types.js";
import type { ConfigError } from "../config/errors.js";
import { parseConfig, type WheelConfig } from "../config/parse.js";
import { buildWidget, type BuiltWidget } from "./builder.js";
import { hasSEApi } from "../se/bootstrap.js";
import { seStore, memoryStore, type Store } from "../se/store.js";
import { parseWheelCommand } from "../se/commands.js";
import { hasCommandPermission, isBroadcasterOrMod } from "../se/permissions.js";
import { parseRedemption } from "../se/redemption.js";
import { consoleListSink, type ListSink } from "../se/sinks.js";
import type { Rng } from "../model/spin.js";

// A runtime-added entry: never persisted as part of cfg.slices, only as an extra
// resolved into the effective slice list on each render.
export interface ExtraEntry {
  text: string;
  user?: string;
}

export type AddEntryResult =
  | { kind: "added"; entry: ExtraEntry }
  | { kind: "rejected"; reason: "empty-text" | "max-reached" | "duplicate-text" | "duplicate-user" };

export type RemoveEntryResult = { kind: "removed" } | { kind: "not-found" };

export interface ControllerOpts {
  rng?: Rng;
  audioCtxFactory?: () => AudioContext;
  store?: Store; // injectable for tests; defaults to seStore() under SE, else memoryStore()
  announceList?: ListSink;
}

export interface WheelController {
  render(): void;
  spin(): void;
  pause(): void;
  resume(): void;
  isPaused(): boolean;
  addEntry(text: string, user?: string, opts?: { enforceRewardLimits?: boolean }): AddEntryResult;
  removeEntry(text: string): RemoveEntryResult;
  resetEntries(): void;
  entries(): string[];
  handleChatMessage(text: string, data: ChatEventData, broadcasterUsername: string | undefined): void;
  handleRedemption(detail: EventReceivedDetail): void;
  ready: Promise<void>; // resolves once the persisted extras (if any) have loaded and rendered
  flush(): Promise<void>; // resolves once the most recent persistence write settles
}

const WIDGET_SLUG = "streamelements-wheel/entries/v1";

function storeKeyFor(channelId: string | undefined): string {
  return `${WIDGET_SLUG}:${channelId ?? "no-channel"}`;
}

// Extras are appended to the base sliceEntries string, comma-joined, with commas in
// extra text replaced by spaces first -- keeps them from being mistaken for a weight
// bracket boundary or splitting into multiple slices.
function effectiveSliceEntries(base: string, extras: readonly ExtraEntry[]): string {
  const parts = extras.map((e) => e.text.replace(/,/g, " ").trim()).filter((t) => t.length > 0);
  return parts.length === 0 ? base : base + ", " + parts.join(", ");
}

function isExtraEntry(v: unknown): v is ExtraEntry {
  return typeof v === "object" && v !== null && typeof (v as { text: unknown }).text === "string";
}

// Owns the mutable slice list (base config slices + runtime-added extras) and rebuilds
// the wheel into a fixed slot on every mutation, carrying the animator's rotation
// forward so a rebuild never visually jumps. Chat command routing and channel-point
// reward matching are handled here rather than in app.ts, since both need the base
// config's command/reward settings alongside the mutable extras.
export function createController(
  doc: Document,
  parent: HTMLElement,
  detail: WidgetLoadDetail,
  opts: ControllerOpts = {},
): WheelController | { error: ConfigError[] } {
  const baseParsed = parseConfig(detail.fieldData);
  if (baseParsed.kind === "error") return { error: baseParsed.errors };
  const baseCfg = baseParsed.value;
  const baseSliceEntries = typeof detail.fieldData.sliceEntries === "string" ? detail.fieldData.sliceEntries : "";

  const store = opts.store ?? (hasSEApi() ? seStore() : memoryStore());
  const announceList = opts.announceList ?? consoleListSink();
  const storeKey = storeKeyFor(detail.channel?.id);

  let extras: ExtraEntry[] = [];
  let paused = false;
  let built: BuiltWidget | undefined;
  let rotationSeed = 0;
  let pending: Promise<void> = Promise.resolve();

  // Fixed parent for the wheel: render() only ever clears/rebuilds this slot, never
  // touching whatever else lives in `parent`.
  const slot = doc.createElement("div");
  slot.className = "wheel-controller-slot";
  parent.appendChild(slot);

  function currentCfg(): WheelConfig {
    const effectiveFieldData = { ...detail.fieldData, sliceEntries: effectiveSliceEntries(baseSliceEntries, extras) };
    const parsed = parseConfig(effectiveFieldData);
    // baseCfg already parsed ok from a non-empty sliceEntries string; appending extras
    // can only add entries, so this can never fail.
    return parsed.kind === "ok" ? parsed.value : baseCfg;
  }

  function render(): void {
    const cfg = currentCfg();
    if (built) rotationSeed = built.currentRotationDeg();
    slot.replaceChildren();
    built = buildWidget(doc, cfg, {
      ...(opts.rng ? { rng: opts.rng } : {}),
      ...(opts.audioCtxFactory ? { audioCtxFactory: opts.audioCtxFactory } : {}),
      initialRotationDeg: rotationSeed,
    });
    slot.appendChild(built.container);
    built.refit();
    if (typeof requestAnimationFrame !== "undefined") {
      const justBuilt = built;
      requestAnimationFrame(() => justBuilt.refit());
    }
  }

  function persist(): Promise<void> {
    return store.set(storeKey, extras).catch(() => {
      // best-effort: extras stays authoritative in memory for this session even if
      // the store write fails.
    });
  }

  async function load(): Promise<void> {
    try {
      const saved = await store.get<ExtraEntry[]>(storeKey);
      if (Array.isArray(saved) && saved.length > 0 && saved.every(isExtraEntry)) {
        extras = saved;
        render();
      }
    } catch {
      // best-effort: start with no persisted extras if the store read fails
    }
  }

  render(); // first paint with base slices only; load() may add extras once it resolves
  const ready = load();

  // enforceRewardLimits: max + one-per-user apply to viewer channel-point redemptions,
  // NOT to trusted mod chat commands (a mod can !wheel add many entries). Text-dedupe
  // always applies so a slice is never listed twice.
  function addEntry(text: string, user?: string, opts: { enforceRewardLimits?: boolean } = {}): AddEntryResult {
    const trimmed = text.trim();
    if (trimmed.length === 0) return { kind: "rejected", reason: "empty-text" };
    if (opts.enforceRewardLimits && baseCfg.addEntryMax > 0 && extras.length >= baseCfg.addEntryMax) {
      return { kind: "rejected", reason: "max-reached" };
    }
    const normText = trimmed.toLowerCase();
    if (extras.some((e) => e.text.toLowerCase() === normText)) {
      return { kind: "rejected", reason: "duplicate-text" };
    }
    if (opts.enforceRewardLimits && baseCfg.addEntryOnePerUser && user) {
      const normUser = user.toLowerCase();
      if (extras.some((e) => (e.user ?? "").toLowerCase() === normUser)) {
        return { kind: "rejected", reason: "duplicate-user" };
      }
    }
    const entry: ExtraEntry = user ? { text: trimmed, user } : { text: trimmed };
    extras.push(entry);
    render();
    pending = persist();
    return { kind: "added", entry };
  }

  function removeEntry(text: string): RemoveEntryResult {
    const norm = text.trim().toLowerCase();
    const idx = extras.findIndex((e) => e.text.toLowerCase() === norm);
    if (idx === -1) return { kind: "not-found" };
    extras.splice(idx, 1);
    render();
    pending = persist();
    return { kind: "removed" };
  }

  function resetEntries(): void {
    if (extras.length === 0) return;
    extras = [];
    render();
    pending = persist();
  }

  function spin(): void {
    if (paused || !built) return;
    built.spin();
  }

  function entries(): string[] {
    return currentCfg().slices.map((s) => s.text);
  }

  function handleChatMessage(text: string, data: ChatEventData, broadcasterUsername: string | undefined): void {
    const trimmed = text.trim();

    // Legacy standalone spin command, kept alongside "<wheelCommand> spin".
    if (trimmed.toLowerCase() === baseCfg.spinCommand.trim().toLowerCase()) {
      if (isBroadcasterOrMod(data, broadcasterUsername)) spin();
      return;
    }

    if (!baseCfg.enableCommands) return;
    const parsed = parseWheelCommand(trimmed, baseCfg.wheelCommand);
    if (!parsed) return;
    if (!hasCommandPermission(baseCfg.commandPermission, data, broadcasterUsername)) return;

    switch (parsed.cmd) {
      case "spin":
        spin();
        return;
      case "add":
        addEntry(parsed.arg); // trusted mod command: no reward limits, no per-user cap
        return;
      case "remove":
        removeEntry(parsed.arg);
        return;
      case "reset":
        resetEntries();
        return;
      case "pause":
        paused = true;
        return;
      case "resume":
        paused = false;
        return;
      case "list":
        announceList.list(entries());
        return;
    }
  }

  // SE redemption payload shapes are unverified against a live session; parseRedemption
  // checks the plausible field locations defensively. See src/se/redemption.ts.
  function handleRedemption(evt: EventReceivedDetail): void {
    if (!baseCfg.enableAddEntryReward) return;
    const parsed = parseRedemption(evt);
    if (!parsed) return;
    if (parsed.rewardTitle.trim().toLowerCase() !== baseCfg.addEntryRewardName.trim().toLowerCase()) return;
    const entryText = baseCfg.addEntrySource === "username" ? parsed.username : (parsed.userInput ?? parsed.username);
    if (!entryText) return;
    addEntry(entryText, parsed.username, { enforceRewardLimits: true });
  }

  return {
    render,
    spin,
    pause: () => {
      paused = true;
    },
    resume: () => {
      paused = false;
    },
    isPaused: () => paused,
    addEntry,
    removeEntry,
    resetEntries,
    entries,
    handleChatMessage,
    handleRedemption,
    ready,
    flush: () => pending,
  };
}
