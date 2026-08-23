import * as esbuild from "esbuild";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { genFields } from "./gen-fields.mjs";

const watch = process.argv.includes("--watch");
const serve = process.argv.includes("--serve");

mkdirSync("dist", { recursive: true });
await genFields();

// Tailwind -> a CSS string we inline (no external stylesheet at runtime).
function buildCss() {
  execFileSync("tailwindcss", ["-i", "src/styles/tailwind.css", "-o", "dist/chrome.css", "--minify"], { stdio: "inherit" });
  const chrome = readFileSync("dist/chrome.css", "utf8");
  const wheel = readFileSync("src/styles/wheel.css", "utf8");
  return chrome + "\n" + wheel;
}

const cssDefine = () => ({ "__INLINE_CSS__": JSON.stringify(buildCss()) });

const opts = {
  entryPoints: ["src/app.ts"],
  bundle: true,
  format: "iife",
  outfile: "dist/wheel.js",
  target: "es2022",
  define: cssDefine(),
  globalName: "Wheel",
};

if (serve) {
  const ctx = await esbuild.context(opts);
  await ctx.watch();
  const { host, port } = await ctx.serve({ servedir: ".", host: "127.0.0.1" });
  console.log(`dev server: http://${host}:${port}/dev/preview.html`);
} else if (watch) {
  const ctx = await esbuild.context(opts);
  await ctx.watch();
} else {
  await esbuild.build(opts);
  writeFileSync("dist/index.html", hostedHtml());
}

// Hosted demo page for GitHub Pages: root-relative ./wheel.js, sample fieldData.
function hostedHtml() {
  return `<!doctype html>
<html><head><meta charset="utf-8" /><title>Spinning Wheel</title>
<style>body{margin:0;display:grid;place-items:center;min-height:100vh;background:#1b1b22}button{position:fixed;top:12px;left:12px;z-index:10}</style>
</head><body>
<button id="spin">Spin</button>
<script src="./wheel.js"></script>
<script>
  var fd = { sliceEntries: "Eat a lemon, Song request [5%], Ranked games, Draw subs [10], Push-ups, Mystery", wheelStyle: "halfwheel", wheelTitle: "50 points to spin", spinDuration: 5, magnetism: false, seamBand: 3, centerIcon: "heart", colorScheme: "sweetheart-original" };
  var handle = window.Wheel.mountWidget(document, { fieldData: fd });
  document.getElementById("spin").addEventListener("click", function(){ handle.spin && handle.spin(); });
</script>
</body></html>
`;
}
