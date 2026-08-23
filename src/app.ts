// Runtime CSS injected at build time.
declare const __INLINE_CSS__: string;

export function mountStyles(doc: Document): void {
  const style = doc.createElement("style");
  style.textContent = __INLINE_CSS__;
  doc.head.appendChild(style);
}
