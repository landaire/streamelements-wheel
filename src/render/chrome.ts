import type { WheelDom } from "./wheel.js";
import type { WheelConfig } from "../config/parse.js";

export interface Chrome {
  title: HTMLElement;
  setTitle(text: string): void;
  refit(): void;
}

const SVG_NS = "http://www.w3.org/2000/svg";

function el(doc: Document, cls: string): HTMLElement {
  const e = doc.createElement("div");
  e.className = cls;
  return e;
}

// Simple inline glyphs for the built-in center icons; unknown icons render no glyph.
const ICON_GLYPHS: Readonly<Record<string, string>> = {
  heart: "M12 21s-7.5-4.6-10-9.3C.6 8.4 2 4.8 5.4 4 7.6 3.5 9.8 4.4 12 6.8 14.2 4.4 16.4 3.5 18.6 4c3.4.8 4.8 4.4 3.4 7.7C19.5 16.4 12 21 12 21z",
  star: "M12 2l2.9 6.4 7 .7-5.3 4.7 1.6 6.9L12 17.6 5.8 20.7l1.6-6.9L2.1 9.1l7-.7L12 2z",
  skull:
    "M12 2C7 2 3.5 5.7 3.5 10c0 3 1.6 4.8 2.5 6v2.4c0 .6.4 1 1 1H8.5v1.6c0 .5.4 1 1 1h.6c.5 0 1-.4 1-1v-1.6h1.8v1.6c0 .5.5 1 1 1h.6c.6 0 1-.5 1-1V18H17c.6 0 1-.4 1-1v-1c.9-1.2 2.5-3 2.5-6C20.5 5.7 17 2 12 2zM8.7 12a1.6 1.6 0 110-3.2 1.6 1.6 0 010 3.2zm6.6 0a1.6 1.6 0 110-3.2 1.6 1.6 0 010 3.2z",
  diamond: "M4 9l4-6h8l4 6-10 12L4 9z",
};

// Coin center icon: a hexagon outline with a "$" glyph, drawn in currentColor (the
// deep-purple hub text color set by .cb-coin) on the light inner disc.
function buildCoinIcon(doc: Document): SVGElement {
  const svg = doc.createElementNS(SVG_NS, "svg") as SVGSVGElement;
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("class", "hub-icon-svg");

  const hex = doc.createElementNS(SVG_NS, "polygon");
  hex.setAttribute("points", "21,12 16.5,19.79 7.5,19.79 3,12 7.5,4.21 16.5,4.21");
  hex.setAttribute("fill", "none");
  hex.setAttribute("stroke", "currentColor");
  hex.setAttribute("stroke-width", "1.6");
  hex.setAttribute("stroke-linejoin", "round");
  svg.appendChild(hex);

  const text = doc.createElementNS(SVG_NS, "text");
  text.setAttribute("x", "12");
  text.setAttribute("y", "16.3");
  text.setAttribute("text-anchor", "middle");
  text.setAttribute("font-size", "11");
  text.setAttribute("font-weight", "700");
  text.setAttribute("fill", "currentColor");
  text.textContent = "$";
  svg.appendChild(text);

  return svg;
}

function buildIconGlyph(doc: Document, icon: string): SVGElement | undefined {
  const d = ICON_GLYPHS[icon];
  if (!d) return undefined;
  const svg = doc.createElementNS(SVG_NS, "svg") as SVGSVGElement;
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("class", "hub-icon-svg");
  const path = doc.createElementNS(SVG_NS, "path");
  path.setAttribute("d", d);
  path.setAttribute("fill", "currentColor");
  svg.appendChild(path);
  return svg;
}

function buildFitText(doc: Document, text: string): HTMLElement {
  // Outer wrap fills the hub and flex-centers; inner element carries the text and
  // gets its font-size scaled to fit. Centering lives on the wrap, so it holds
  // regardless of whether the fit pass has run yet.
  const wrap = el(doc, "hub-text hub-text-fit");
  const inner = el(doc, "hub-text-inner");
  inner.textContent = text; // CSS white-space: pre-wrap renders \n and wraps long lines
  wrap.appendChild(inner);
  return wrap;
}

// Auto-scales the hub text's font-size to fill the wrap (the circle's padded inscribed
// box). No-ops when the wrap has no real layout (e.g. before the widget is attached, or
// jsdom without a stylesheet); app.ts re-runs it after the widget is in the document.
export function fitHubText(wrap: HTMLElement): void {
  const inner = wrap.querySelector<HTMLElement>(".hub-text-inner");
  if (!inner) return;
  if (!wrap.clientWidth || !wrap.clientHeight) return;
  const inset = 0.68; // keep the text within the circle's inscribed square
  const targetW = wrap.clientWidth * inset;
  const targetH = wrap.clientHeight * inset;
  let lo = 6;
  let hi = 120;
  for (let i = 0; i < 14; i++) {
    const mid = (lo + hi) / 2;
    inner.style.fontSize = mid + "px";
    const fits = inner.scrollWidth <= targetW && inner.scrollHeight <= targetH;
    if (fits) lo = mid;
    else hi = mid;
  }
  inner.style.fontSize = lo + "px";
}

// Slice-label font-size bounds, in the 500px base coordinate space. Labels grow to fill
// their wedge as large as fits (capped at MAX to stay tasteful) and shrink no smaller than
// MIN. R is 250 in practice, so MAX ~ 34% of the disc radius on the biggest slices.
const MIN_ENTRY_FONT_PX = 6;
const MAX_ENTRY_FONT_PX = 40;
// The label sits centred in the radial band between the hub and the rim, and reads across
// most of that band before wrapping (a little safe room, not too much).
const LABEL_MID_R = 0.56; // fraction of R at the label centre
const LABEL_RADIAL = 0.62; // fraction of R the label may span radially
const LABEL_TANGENT = 0.86; // fraction of the wedge's angular width the label may use

// Returns the largest font-size (px) at which a slice label fits its wedge: radially (line
// length, capped by maxWidth so long text wraps) and tangentially (stacked-line height,
// capped by the wedge's angular width). Sets that size on the element and returns it.
// Returns MIN when R is 0 (no live layout yet, e.g. pre-attach or jsdom).
export function fitEntryText(textEl: HTMLElement, sizeTurn: number, R: number): number {
  if (!R) return MIN_ENTRY_FONT_PX;
  const rText = LABEL_MID_R * R;
  const radialLen = LABEL_RADIAL * R;
  const tangentialWidth = 2 * rText * Math.sin(sizeTurn * Math.PI) * LABEL_TANGENT;
  textEl.style.maxWidth = radialLen + "px";
  let lo = MIN_ENTRY_FONT_PX;
  let hi = MAX_ENTRY_FONT_PX;
  for (let i = 0; i < 16; i++) {
    const mid = (lo + hi) / 2;
    textEl.style.fontSize = mid + "px";
    const fits = textEl.scrollHeight <= tangentialWidth && textEl.scrollWidth <= radialLen;
    if (fits) lo = mid;
    else hi = mid;
  }
  textEl.style.fontSize = lo + "px";
  return lo;
}

// Refits every slice label, then unifies the size: the bulk of the labels share one common
// size (the largest all of them fit), and only labels in much tighter wedges keep their own
// smaller size. dom.container.clientWidth is 0 before attach or under jsdom, so this no-ops.
export function refitEntries(dom: WheelDom): void {
  const R = dom.container.clientWidth / 2;
  if (!R) return;
  const els: HTMLElement[] = [];
  const fits: number[] = [];
  for (const entry of dom.entries) {
    const sizeTurn = Number(entry.dataset.sizeTurn);
    if (!Number.isFinite(sizeTurn)) continue;
    const textEl = entry.querySelector<HTMLElement>(".entry-text");
    if (!textEl) continue;
    fits.push(fitEntryText(textEl, sizeTurn, R));
    els.push(textEl);
  }
  if (els.length === 0) return;
  const maxFit = Math.max(...fits);
  // Common size = smallest fit among labels that are not far-tighter outliers.
  let common = maxFit;
  for (const f of fits) {
    if (f >= maxFit * 0.55) common = Math.min(common, f);
  }
  els.forEach((el, i) => {
    el.style.fontSize = Math.min(common, fits[i]!) + "px";
  });
}

// Curved hub text flows along a circular textPath. jsdom has no font metrics, so the
// font-size is an arc-length heuristic rather than a measured fit.
//
// The path spans the top semicircle only (9 o'clock, over 12 o'clock, to 3 o'clock),
// left-to-right. Previously the path traced the full circle; a startOffset of 50%
// landed exactly on the seam between the two halves (3 o'clock), producing a cramped
// arc on the right instead of text centered across the top.
function buildCurvedText(doc: Document, text: string): SVGElement {
  const svg = doc.createElementNS(SVG_NS, "svg") as SVGSVGElement;
  svg.setAttribute("viewBox", "0 0 100 100");
  svg.setAttribute("class", "hub-text-curve");

  const defs = doc.createElementNS(SVG_NS, "defs");
  const path = doc.createElementNS(SVG_NS, "path");
  const pathId = "hub-curve-path-" + Math.random().toString(36).slice(2);
  path.setAttribute("id", pathId);
  const radius = 34;
  path.setAttribute("d", `M ${50 - radius} 50 A ${radius} ${radius} 0 0 1 ${50 + radius} 50`);
  defs.appendChild(path);
  svg.appendChild(defs);

  const len = Math.max(text.length, 1);
  const arcLength = Math.PI * radius; // top half of the circumference
  // Average glyph advance for bold caps is roughly 0.6em; leave a small margin.
  const fontSize = Math.max(4, Math.min(16, arcLength / (len * 0.62)));

  const textEl = doc.createElementNS(SVG_NS, "text");
  textEl.setAttribute("class", "hub-text-curve-text");
  textEl.style.fontSize = fontSize + "px";
  const textPath = doc.createElementNS(SVG_NS, "textPath");
  textPath.setAttribute("href", "#" + pathId);
  textPath.setAttribute("startOffset", "50%");
  textPath.setAttribute("text-anchor", "middle");
  textPath.textContent = text;
  textEl.appendChild(textPath);
  svg.appendChild(textEl);
  return svg;
}

// A simple plumbob gem for the fixed pointer: one flat gem body with a single vertical
// gradient (scheme --gem-* colors, so it matches the palette), a plain white outline, and
// one soft top glint. Gradient id is per-call so mounted widgets never share a def id.
function buildEmeraldPointer(doc: Document): SVGElement {
  const uid = Math.random().toString(36).slice(2);
  const svg = doc.createElementNS(SVG_NS, "svg") as SVGSVGElement;
  svg.setAttribute("viewBox", "0 0 100 140");
  svg.setAttribute("class", "headpiece-gem");

  const defs = doc.createElementNS(SVG_NS, "defs");
  const grad = doc.createElementNS(SVG_NS, "linearGradient");
  grad.setAttribute("id", "gem-" + uid);
  grad.setAttribute("x1", "0%");
  grad.setAttribute("y1", "0%");
  grad.setAttribute("x2", "0%");
  grad.setAttribute("y2", "100%");
  const stops: [string, string][] = [["0%", "var(--gem-light)"], ["55%", "var(--gem-mid)"], ["100%", "var(--gem-dark)"]];
  for (const [offset, color] of stops) {
    const stop = doc.createElementNS(SVG_NS, "stop");
    stop.setAttribute("offset", offset);
    // var()-based stop colors resolve only through the CSS style property, not the attribute.
    stop.style.setProperty("stop-color", color);
    grad.appendChild(stop);
  }
  defs.appendChild(grad);
  svg.appendChild(defs);

  const poly = (points: string, fill: string, extra?: Record<string, string>): void => {
    const p = doc.createElementNS(SVG_NS, "polygon");
    p.setAttribute("points", points);
    p.setAttribute("fill", fill);
    if (extra) for (const [k, v] of Object.entries(extra)) p.setAttribute(k, v);
    svg.appendChild(p);
  };

  const silhouette = "30,0 70,0 76,20 94,56 50,138 6,56 24,20";
  poly(silhouette, "#ffffff", { transform: "translate(50 60) scale(1.12) translate(-50 -60)" }); // plain white outline
  poly(silhouette, `url(#gem-${uid})`); // gem body
  poly("30,4 70,4 73,20 27,20", "rgba(255,255,255,0.22)"); // soft top glint

  return svg;
}

function buildHub(doc: Document, centerpiece: HTMLElement, cfg: WheelConfig): void {
  if (cfg.hubMode === "image") {
    // Inset the image into the centerpiece rather than covering it: the surrounding
    // ring keeps the knob's bevel/rim visible, and a gloss overlay sits on top of the
    // image itself so it still reads as a physical glossy button, not a flat photo.
    const imgWrap = el(doc, "hub-image-wrap");
    const img = doc.createElement("img");
    img.className = "hub-image";
    img.src = cfg.hubImage;
    img.alt = "";
    imgWrap.appendChild(img);
    centerpiece.appendChild(imgWrap);
    centerpiece.appendChild(el(doc, "hub-image-gloss"));
    return;
  }
  if (cfg.hubMode === "text") {
    if (cfg.hubTextStyle === "curve") centerpiece.appendChild(buildCurvedText(doc, cfg.hubText));
    else centerpiece.appendChild(buildFitText(doc, cfg.hubText));
    return;
  }
  const icon = el(doc, "center-icon cb-" + cfg.centerIcon);
  const glyph = cfg.centerIcon === "coin" ? buildCoinIcon(doc) : buildIconGlyph(doc, cfg.centerIcon);
  if (glyph) icon.appendChild(glyph);
  centerpiece.appendChild(icon);
}

// Base coordinate box the widget is authored in; --fit-scale scales it into the host box.
const BASE_W = 500;
const BASE_H = 596; // 500 disc + 96 headroom (must match --disc + --hr in wheel.css)
const FIT_MARGIN = 0.9; // leaves breathing room inside the box so nothing sits against an edge

export function addChrome(doc: Document, dom: WheelDom, cfg: WheelConfig): Chrome {
  // Scale the whole widget to fit the available area (host layer minus any side panel via
  // --stage-left) and centre it. Runs on mount and on resize.
  const fitStage = (): void => {
    if (typeof window === "undefined") return;
    const stageLeft = parseFloat(getComputedStyle(dom.container).getPropertyValue("--stage-left")) || 0;
    const availW = Math.max(1, window.innerWidth - stageLeft);
    const availH = Math.max(1, window.innerHeight);
    const fit = Math.min(availW / BASE_W, availH / BASE_H) * FIT_MARGIN * cfg.scale;
    dom.container.style.setProperty("--fit-scale", String(fit));
  };

  const details = el(doc, "details");
  const centerpiece = el(doc, "centerpiece");
  buildHub(doc, centerpiece, cfg);
  const headpiece = el(doc, "headpiece"); // fixed pointer at 12 o'clock; does not rotate
  headpiece.appendChild(buildEmeraldPointer(doc));
  details.appendChild(centerpiece);
  details.appendChild(headpiece);
  dom.container.appendChild(details);

  const titleWrap = el(doc, "title-wrap"); // sits above the headpiece/pointer
  const title = el(doc, "title-text");
  title.textContent = cfg.title;
  titleWrap.appendChild(title);
  dom.container.appendChild(titleWrap);
  // Hide the pill entirely while there is no title text (empty title, pre-spin).
  const syncTitleVisibility = (text: string): void => {
    titleWrap.style.display = text.trim().length > 0 ? "" : "none";
  };
  syncTitleVisibility(cfg.title);

  // Keep the pill from resizing as the slot-machine roll cycles labels: its min-width is the
  // widest of the title, the current text, and every option (plus a buffer for font metrics),
  // and it is only recomputed on a debounce so the rapid roll never resizes it mid-spin. A
  // CSS transition smooths the one change that does happen (a wider two-option winner).
  const measureCtx = doc.createElement("canvas").getContext("2d");
  const fitTitleWidth = (): void => {
    if (!measureCtx) return;
    const cs = getComputedStyle(title);
    if (!cs.fontSize || cs.fontSize === "0px") return;
    measureCtx.font = cs.fontWeight + " " + cs.fontSize + " " + cs.fontFamily;
    let max = Math.max(measureCtx.measureText(cfg.title).width, measureCtx.measureText(title.textContent ?? "").width);
    for (const s of cfg.slices) max = Math.max(max, measureCtx.measureText(s.text).width);
    titleWrap.style.minWidth = Math.ceil(max * 1.04) + 16 + "px";
  };
  let titleSizeTimer: ReturnType<typeof setTimeout> | undefined;
  const fitTitleWidthDebounced = (): void => {
    if (titleSizeTimer) clearTimeout(titleSizeTimer);
    titleSizeTimer = setTimeout(fitTitleWidth, 220);
  };

  const fitTextEl = centerpiece.querySelector<HTMLElement>(".hub-text-fit");
  const refit = (): void => {
    fitStage();
    fitTitleWidth();
    if (fitTextEl) fitHubText(fitTextEl);
    refitEntries(dom);
  };
  refit();
  if (typeof window !== "undefined") {
    window.addEventListener("resize", refit);
  }
  // The configured font loads async; re-fit once it is ready so text measurements use it.
  if (doc.fonts && typeof doc.fonts.ready?.then === "function") {
    void doc.fonts.ready.then(refit);
  }

  return {
    title,
    setTitle: (text: string): void => {
      title.textContent = text;
      syncTitleVisibility(text);
      fitTitleWidthDebounced(); // re-fit only once the title settles, not on every roll frame
    },
    refit,
  };
}
