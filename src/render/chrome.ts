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

// Base entry font-size, matching --entry-font-size's default in wheel.css. Fit only
// ever shrinks from here; there is no per-config entries font-size field yet.
const BASE_ENTRY_FONT_PX = 15;

// Auto-scales one slice label's font-size to fit within its slice, both radially (the
// line length, capped by maxWidth so long text wraps) and tangentially (the stacked-line
// height, capped by the slice's angular width at the label's radius). No-ops when R is 0
// (no live layout yet, e.g. pre-attach or jsdom).
export function fitEntryText(textEl: HTMLElement, sizeTurn: number, R: number): void {
  if (!R) return;
  const rText = 0.6 * R; // radius at which the label is centered
  const radialLen = 0.56 * R; // available length along the radial line
  const tangentialWidth = 2 * rText * Math.sin(sizeTurn * Math.PI) * 0.82; // available width across the slice
  textEl.style.maxWidth = radialLen + "px";
  let lo = 5;
  let hi = BASE_ENTRY_FONT_PX;
  for (let i = 0; i < 14; i++) {
    const mid = (lo + hi) / 2;
    textEl.style.fontSize = mid + "px";
    const fits = textEl.scrollHeight <= tangentialWidth && textEl.scrollWidth <= radialLen;
    if (fits) lo = mid;
    else hi = mid;
  }
  textEl.style.fontSize = lo + "px";
}

// Refits every slice label against the wheel's live size. dom.container.clientWidth is
// 0 before attach or under jsdom (no stylesheet layout), so this no-ops safely there,
// same as fitHubText.
export function refitEntries(dom: WheelDom): void {
  const R = dom.container.clientWidth / 2;
  if (!R) return;
  for (const entry of dom.entries) {
    const sizeTurnAttr = entry.dataset.sizeTurn;
    if (!sizeTurnAttr) continue;
    const sizeTurn = Number(sizeTurnAttr);
    if (!Number.isFinite(sizeTurn)) continue;
    const textEl = entry.querySelector<HTMLElement>(".entry-text");
    if (!textEl) continue;
    fitEntryText(textEl, sizeTurn, R);
  }
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

// A faceted emerald gem for the fixed pointer: a gold bezel setting at the mount, a
// crown of light-to-mid green facets, a bright specular highlight facet, and a darker
// pavilion tapering to the tip that touches the rim. Gradient ids are per-call so
// multiple mounted widgets never share (and fight over) the same SVG def id.
function buildEmeraldPointer(doc: Document): SVGElement {
  const uid = Math.random().toString(36).slice(2);
  const svg = doc.createElementNS(SVG_NS, "svg") as SVGSVGElement;
  svg.setAttribute("viewBox", "0 0 100 140");
  svg.setAttribute("class", "headpiece-gem");

  const defs = doc.createElementNS(SVG_NS, "defs");
  const gradients: [string, [string, string][]][] = [
    ["bezel-" + uid, [["0%", "#f7e08a"], ["45%", "#c9962f"], ["100%", "#7a5716"]]],
    ["table-" + uid, [["0%", "#eafff0"], ["100%", "#57c98a"]]],
    ["crown-l-" + uid, [["0%", "#bdf7cf"], ["100%", "#1f8a54"]]],
    ["crown-r-" + uid, [["0%", "#8fe8ae"], ["100%", "#146339"]]],
    ["pav-l-" + uid, [["0%", "#2f9c62"], ["100%", "#0f5132"]]],
    ["pav-r-" + uid, [["0%", "#1c7042"], ["100%", "#08301d"]]],
  ];
  for (const [id, stops] of gradients) {
    const grad = doc.createElementNS(SVG_NS, "linearGradient");
    grad.setAttribute("id", id);
    grad.setAttribute("x1", "0%");
    grad.setAttribute("y1", "0%");
    grad.setAttribute("x2", "0%");
    grad.setAttribute("y2", "100%");
    for (const [offset, color] of stops) {
      const stop = doc.createElementNS(SVG_NS, "stop");
      stop.setAttribute("offset", offset);
      stop.setAttribute("stop-color", color);
      grad.appendChild(stop);
    }
    defs.appendChild(grad);
  }
  svg.appendChild(defs);

  const poly = (points: string, fill: string, extra?: Record<string, string>): void => {
    const p = doc.createElementNS(SVG_NS, "polygon");
    p.setAttribute("points", points);
    p.setAttribute("fill", fill);
    if (extra) for (const [k, v] of Object.entries(extra)) p.setAttribute(k, v);
    svg.appendChild(p);
  };

  // Gold bezel where the gem mounts to the rim edge.
  poly("30,0 70,0 76,20 24,20", `url(#bezel-${uid})`);
  // Pavilion (lower, shaded facets) drawn first so the crown's girdle overlaps it cleanly.
  poly("6,56 50,74 50,138", `url(#pav-l-${uid})`);
  poly("94,56 50,74 50,138", `url(#pav-r-${uid})`);
  // Crown (upper, brighter facets).
  poly("24,20 50,20 50,74 6,56", `url(#crown-l-${uid})`);
  poly("76,20 50,20 50,74 94,56", `url(#crown-r-${uid})`);
  // Table facet: the brightest top-facing cut.
  poly("34,20 66,20 58,32 42,32", `url(#table-${uid})`);
  // Specular highlight: a light reflection hugging the top-left crown facet edges.
  poly("25,21 41,21 28,40", "rgba(255,255,255,0.55)");

  // Crisp facet edges.
  const edges = [
    "50,20 50,138",
    "24,20 6,56",
    "76,20 94,56",
    "6,56 50,74 94,56",
    "34,20 42,32",
    "66,20 58,32",
  ];
  for (const d of edges) {
    const line = doc.createElementNS(SVG_NS, "polyline");
    line.setAttribute("points", d);
    line.setAttribute("fill", "none");
    line.setAttribute("stroke", "#0a3d24");
    line.setAttribute("stroke-width", "0.8");
    line.setAttribute("stroke-opacity", "0.55");
    line.setAttribute("stroke-linejoin", "round");
    svg.appendChild(line);
  }

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
  const glyph = buildIconGlyph(doc, cfg.centerIcon);
  if (glyph) icon.appendChild(glyph);
  centerpiece.appendChild(icon);
}

export function addChrome(doc: Document, dom: WheelDom, cfg: WheelConfig): Chrome {
  dom.container.style.setProperty("--scale", String(cfg.scale));

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

  const fitTextEl = centerpiece.querySelector<HTMLElement>(".hub-text-fit");
  const refit = (): void => {
    if (fitTextEl) fitHubText(fitTextEl);
    refitEntries(dom);
  };
  refit();
  if (typeof window !== "undefined") {
    window.addEventListener("resize", refit);
  }

  return {
    title,
    setTitle: (text: string): void => {
      title.textContent = text;
    },
    refit,
  };
}
