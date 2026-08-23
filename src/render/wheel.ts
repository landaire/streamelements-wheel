import type { WheelConfig } from "../config/parse.js";
import { layout, sliceCenterDeg, type SliceLayout } from "../model/geometry.js";

export interface WheelDom {
  container: HTMLElement;
  wheel: HTMLElement;
  slices: HTMLElement[];
  entries: HTMLElement[];
  setRotation(deg: number): void;
}

function el(doc: Document, cls: string): HTMLElement {
  const e = doc.createElement("div");
  e.className = cls;
  return e;
}

export function buildWheel(doc: Document, cfg: WheelConfig): WheelDom {
  const container = el(doc, "wheel-container theme set-style-" + cfg.style);
  const wheel = el(doc, "wheel");
  const sliceWrap = el(doc, "slice-wrap");
  const entryWrap = el(doc, "entry-wrap");
  wheel.appendChild(sliceWrap);
  wheel.appendChild(entryWrap);
  container.appendChild(wheel);

  const laid: SliceLayout[] = layout(cfg.slices);
  const slices: HTMLElement[] = [];
  const entries: HTMLElement[] = [];

  laid.forEach((l, i) => {
    const slice = el(doc, "slice");
    slice.style.setProperty("--slice-start", (l.startTurn as number) + "turn");
    slice.style.setProperty("--slice-size", (l.sizeTurn as number) + "turn");
    slice.style.setProperty("--slice-bg", i % 2 === 0 ? "var(--slice-bg-even)" : "var(--slice-bg-odd)");
    sliceWrap.appendChild(slice);
    slices.push(slice);

    const entry = el(doc, "entry");
    entry.style.setProperty("--entry-mid-deg", (sliceCenterDeg(l) as number) + "deg");
    const text = el(doc, "entry-text");
    text.textContent = cfg.slices[i]!.text;
    entry.appendChild(text);
    entryWrap.appendChild(entry);
    entries.push(entry);
  });

  const setRotation = (deg: number): void => {
    wheel.style.setProperty("--spin-degree", deg + "deg");
  };
  setRotation(0);

  return { container, wheel, slices, entries, setRotation };
}
