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
// Rim band thickness, ~7% of R; drawn as a stroked circle so it scales with the
// viewBox (and therefore with --scale) instead of a fixed-px CSS box-shadow.
const RIM_THICKNESS = 18;
const RIM_CENTER_R = 250 - RIM_THICKNESS / 2;

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

  // Overlays: siblings of .wheel (not children), so they never rotate.
  const sheen = el(doc, "wheel-sheen");
  const highlight = el(doc, "wheel-highlight");

  // Thick rim band + a slightly darker inner edge line, overlapping the outer edge
  // of the slice fill like a bezel.
  const rimSvg = doc.createElementNS(SVG_NS, "svg") as SVGSVGElement;
  rimSvg.setAttribute("viewBox", "0 0 500 500");
  rimSvg.setAttribute("class", "wheel-rim-svg");
  const rimBand = doc.createElementNS(SVG_NS, "circle");
  rimBand.setAttribute("cx", String(CX));
  rimBand.setAttribute("cy", String(CY));
  rimBand.setAttribute("r", String(RIM_CENTER_R));
  rimBand.setAttribute("fill", "none");
  rimBand.style.stroke = "var(--rim-color, #6f2f80)";
  rimBand.style.strokeWidth = String(RIM_THICKNESS);
  rimSvg.appendChild(rimBand);
  const rimInnerEdge = doc.createElementNS(SVG_NS, "circle");
  rimInnerEdge.setAttribute("cx", String(CX));
  rimInnerEdge.setAttribute("cy", String(CY));
  rimInnerEdge.setAttribute("r", String(RIM_CENTER_R - RIM_THICKNESS / 2));
  rimInnerEdge.setAttribute("fill", "none");
  rimInnerEdge.style.stroke = "rgba(0, 0, 0, 0.5)";
  rimInnerEdge.style.strokeWidth = "3.5";
  rimSvg.appendChild(rimInnerEdge);

  wheelClip.appendChild(wheel);
  wheelClip.appendChild(sheen);
  wheelClip.appendChild(highlight);
  wheelClip.appendChild(rimSvg);
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
    // A category slice carries its own color; other slices keep the alternating
    // even/odd scheme fill.
    const sliceColor = cfg.slices[i]!.color;
    path.setAttribute("fill", sliceColor ?? (isEven ? "var(--slice-bg-even)" : "var(--slice-bg-odd)"));
    svg.appendChild(path);
    slices.push(path);

    const entry = el(doc, "entry");
    entry.style.setProperty("--entry-mid-deg", (sliceCenterDeg(l) as number) + "deg");
    entry.dataset.sizeTurn = String(l.sizeTurn as number);
    const text = el(doc, "entry-text");
    text.textContent = cfg.slices[i]!.text;
    entry.appendChild(text);
    entryWrap.appendChild(entry);
    entries.push(entry);
  });

  // One divider per slice boundary, drawn as a radial line from the hub to the rim. Exactly
  // one line per seam (never a per-slice outline), so borders can never double up regardless
  // of slice count or weights.
  laid.forEach((l) => {
    const seam = pointOnCircle((l.startTurn as number) * 360);
    const line = doc.createElementNS(SVG_NS, "line");
    line.setAttribute("x1", String(CX));
    line.setAttribute("y1", String(CY));
    line.setAttribute("x2", String(seam.x));
    line.setAttribute("y2", String(seam.y));
    line.style.stroke = "var(--slice-border, #c76b7d)";
    line.style.strokeWidth = "2.5";
    svg.appendChild(line);
  });

  const setRotation = (deg: number): void => {
    wheel.style.setProperty("--spin-degree", deg + "deg");
  };
  setRotation(0);

  return { container, wheel, slices, entries, setRotation };
}
