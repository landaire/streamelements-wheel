// Best-effort cropping of a hub image's transparent margins at render time, so a supplied
// image (file, data URL, or remote URL) shows only its true content. Data URLs and same-origin
// images are always readable; a cross-origin URL is probed with a CORS-enabled loader so a
// host without CORS simply keeps its original, untrimmed pixels instead of failing to load.

function tightCropDataUrl(doc: Document, source: CanvasImageSource, w: number, h: number): string | null {
  if (!w || !h) return null;
  const canvas = doc.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(source, 0, 0);
  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, w, h).data;
  } catch {
    return null; // cross-origin without CORS taints the canvas; cannot read pixels
  }
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3]! > 8) {
        // alpha above a small threshold = real content
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null; // fully transparent: nothing to keep
  if (minX === 0 && minY === 0 && maxX === w - 1 && maxY === h - 1) return null; // no margin to trim
  const tw = maxX - minX + 1;
  const th = maxY - minY + 1;
  const out = doc.createElement("canvas");
  out.width = tw;
  out.height = th;
  const octx = out.getContext("2d");
  if (!octx) return null;
  octx.drawImage(canvas, minX, minY, tw, th, 0, 0, tw, th);
  return out.toDataURL("image/png");
}

function whenReady(img: HTMLImageElement, cb: () => void): void {
  if (img.complete && img.naturalWidth) cb();
  else img.addEventListener("load", cb, { once: true });
}

// Trims img in place by swapping its src to a cropped data URL once the pixels are readable.
export function trimHubImage(doc: Document, img: HTMLImageElement): void {
  const src = img.src;
  if (!src) return;
  if (src.startsWith("data:")) {
    whenReady(img, () => {
      const cropped = tightCropDataUrl(doc, img, img.naturalWidth, img.naturalHeight);
      if (cropped && cropped !== img.src) img.src = cropped;
    });
    return;
  }
  const probe = doc.createElement("img");
  probe.crossOrigin = "anonymous"; // request CORS so the pixels are readable when the host allows it
  probe.addEventListener(
    "load",
    () => {
      const cropped = tightCropDataUrl(doc, probe, probe.naturalWidth, probe.naturalHeight);
      if (cropped) img.src = cropped;
    },
    { once: true },
  );
  probe.addEventListener("error", () => undefined, { once: true }); // no CORS: keep the original image
  probe.src = src;
}
