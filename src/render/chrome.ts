import type { WheelDom } from "./wheel.js";
import type { WheelConfig } from "../config/parse.js";

export interface Chrome {
  title: HTMLElement;
  setTitle(text: string): void;
}

function el(doc: Document, cls: string): HTMLElement {
  const e = doc.createElement("div");
  e.className = cls;
  return e;
}

export function addChrome(doc: Document, dom: WheelDom, cfg: WheelConfig): Chrome {
  dom.container.style.setProperty("--scale", String(cfg.scale));

  const details = el(doc, "details");
  const centerpiece = el(doc, "centerpiece");
  const icon = el(doc, "center-icon cb-" + cfg.centerIcon);
  centerpiece.appendChild(icon);
  const headpiece = el(doc, "headpiece"); // fixed pointer at 12 o'clock; does not rotate
  details.appendChild(centerpiece);
  details.appendChild(headpiece);
  dom.container.appendChild(details);

  const titleWrap = el(doc, "title-wrap");
  const title = el(doc, "title-text");
  title.textContent = cfg.title;
  titleWrap.appendChild(title);
  dom.container.appendChild(titleWrap);

  return {
    title,
    setTitle: (text: string): void => {
      title.textContent = text;
    },
  };
}
