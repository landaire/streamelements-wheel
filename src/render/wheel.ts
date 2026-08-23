import type { WheelConfig } from "../config/parse.js";
import { layout, sliceCenterDeg, type SliceLayout } from "../model/geometry.js";

export interface WheelDom {
  container: HTMLElement;
  wheel: HTMLElement;
  slices: SVGPathElement[];
  entries: HTMLElement[];
  setRotation(deg: number): void;
}

const SVG_NS = "http://www.w3.org/2000/svg";
// Disc geometry: center (CX, CY), outer radius R, in the 0..500 viewBox.
const CX = 250;
const CY = 250;
const R = 244;

function el(doc: Document, cls: string): HTMLElement {
  const e = doc.createElement("div");
  e.className = cls;
  return e;
}

// Pointer-space angle a (0 = 3 o'clock, matches model/geometry) mapped to a screen point.
// beta = a - 90 is degrees clockwise from the top, which is where the fixed pointer sits.
function pointOnCircle(aDeg: number): { x: number; y: number } {
  const beta = ((aDeg - 90) * Math.PI) / 180;
  return { x: CX + R * Math.sin(beta), y: CY - R * Math.cos(beta) };
}

function wedgePathD(a0: number, a1: number): string {
  const largeArc = a1 - a0 > 180 ? 1 : 0;
  const p0 = pointOnCircle(a0);
  const p1 = pointOnCircle(a1);
  return `M ${CX} ${CY} L ${p0.x} ${p0.y} A ${R} ${R} 0 ${largeArc} 1 ${p1.x} ${p1.y} Z`;
}

export function buildWheel(doc: Document, cfg: WheelConfig): WheelDom {
  const container = el(doc, "wheel-container theme set-style-" + cfg.style);

  // wheel-clip is the non-rotating wrapper: halfwheel clips it, never the rotating .wheel.
  const wheelClip = el(doc, "wheel-clip");
  const wheel = el(doc, "wheel");

  const svg = doc.createElementNS(SVG_NS, "svg") as SVGSVGElement;
  svg.setAttribute("viewBox", "0 0 500 500");
  svg.setAttribute("class", "wheel-svg");
  wheel.appendChild(svg);

  const entryWrap = el(doc, "entry-wrap");
  wheel.appendChild(entryWrap);

  // Skeuomorphic overlays: siblings of .wheel (not children), so they never rotate.
  const sheen = el(doc, "wheel-sheen");
  const highlight = el(doc, "wheel-highlight");
  const rim = el(doc, "wheel-rim");

  wheelClip.appendChild(wheel);
  wheelClip.appendChild(sheen);
  wheelClip.appendChild(highlight);
  wheelClip.appendChild(rim);
  container.appendChild(wheelClip);

  const laid: SliceLayout[] = layout(cfg.slices);
  const slices: SVGPathElement[] = [];
  const entries: HTMLElement[] = [];

  laid.forEach((l, i) => {
    const a0 = (l.startTurn as number) * 360;
    const a1 = a0 + (l.sizeTurn as number) * 360;
    const isEven = i % 2 === 0;

    const path = doc.createElementNS(SVG_NS, "path") as SVGPathElement;
    path.setAttribute("class", "slice slice-" + (isEven ? "even" : "odd"));
    path.setAttribute("d", wedgePathD(a0, a1));
    path.setAttribute("fill", isEven ? "var(--slice-bg-even)" : "var(--slice-bg-odd)");
    // Only the darker (even) slices get a border, and it is darker than the slice fill.
    if (isEven) {
      path.style.stroke = "var(--slice-border, #c76b7d)";
      path.style.strokeWidth = "2";
      path.style.strokeLinejoin = "round";
    }
    svg.appendChild(path);
    slices.push(path);

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
