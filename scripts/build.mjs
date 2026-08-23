import * as esbuild from "esbuild";
import { execFileSync } from "node:child_process";
import { readFileSync, mkdirSync } from "node:fs";

const watch = process.argv.includes("--watch");
const serve = process.argv.includes("--serve");

mkdirSync("dist", { recursive: true });

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
}
