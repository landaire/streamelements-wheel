import type { WheelDom } from "./wheel.js";
import type { WheelConfig } from "../config/parse.js";

export interface Chrome {
  title: HTMLElement;
  setTitle(text: string): void;
  refitHub(): void;
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
  const wrap = el(doc, "hub-text hub-text-fit");
  wrap.textContent = text; // CSS white-space: pre-wrap renders \n and wraps long lines
  return wrap;
}

// Auto-scales the hub text's font-size to fit the inscribed box of the hub circle.
// No-ops when the element has no real layout (e.g. jsdom without a stylesheet loaded).
export function fitHubText(wrap: HTMLElement): void {
  const parent = wrap.parentElement;
  if (!parent) return;
  const maxW = parent.clientWidth;
  const maxH = parent.clientHeight;
  if (!maxW || !maxH) return;
  const inset = 0.72; // safe margin inside the circle's inscribed square
  const targetW = maxW * inset;
  const targetH = maxH * inset;
  let lo = 6;
  let hi = 96;
  for (let i = 0; i < 12; i++) {
    const mid = (lo + hi) / 2;
    wrap.style.fontSize = mid + "px";
    const fits = wrap.scrollWidth <= targetW && wrap.scrollHeight <= targetH;
    if (fits) lo = mid;
    else hi = mid;
  }
  wrap.style.fontSize = lo + "px";
}

// Curved hub text flows along a circular textPath. jsdom has no font metrics, so the
// font-size is a circumference-based heuristic rather than a measured fit.
function buildCurvedText(doc: Document, text: string): SVGElement {
  const svg = doc.createElementNS(SVG_NS, "svg") as SVGSVGElement;
  svg.setAttribute("viewBox", "0 0 100 100");
  svg.setAttribute("class", "hub-text-curve");

  const defs = doc.createElementNS(SVG_NS, "defs");
  const path = doc.createElementNS(SVG_NS, "path");
  const pathId = "hub-curve-path-" + Math.random().toString(36).slice(2);
  path.setAttribute("id", pathId);
  path.setAttribute("d", "M 50 50 m -34 0 a 34 34 0 1 1 68 0 a 34 34 0 1 1 -68 0");
  defs.appendChild(path);
  svg.appendChild(defs);

  const len = Math.max(text.length, 1);
  const circumference = 2 * Math.PI * 34;
  const fontSize = Math.max(4, Math.min(11, (circumference * 0.85) / len));

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

function buildHub(doc: Document, centerpiece: HTMLElement, cfg: WheelConfig): void {
  if (cfg.hubMode === "image") {
    const img = doc.createElement("img");
    img.className = "hub-image";
    img.src = cfg.hubImage;
    img.alt = "";
    centerpiece.appendChild(img);
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
  details.appendChild(centerpiece);
  details.appendChild(headpiece);
  dom.container.appendChild(details);

  const titleWrap = el(doc, "title-wrap"); // sits above the headpiece/pointer
  const title = el(doc, "title-text");
  title.textContent = cfg.title;
  titleWrap.appendChild(title);
  dom.container.appendChild(titleWrap);

  const fitTextEl = centerpiece.querySelector<HTMLElement>(".hub-text-fit");
  const refitHub = (): void => {
    if (fitTextEl) fitHubText(fitTextEl);
  };
  refitHub();
  if (typeof window !== "undefined" && fitTextEl) {
    window.addEventListener("resize", refitHub);
  }

  return {
    title,
    setTitle: (text: string): void => {
      title.textContent = text;
    },
    refitHub,
  };
}
