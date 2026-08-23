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
  writeFileSync("dist/index.html", landingHtml());
  writeFileSync("dist/demo.html", demoHtml());
}

// Landing page: plain operating-manual style. No color, no salesmanship.
function landingHtml() {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Spinning Wheel - Instructions</title>
<style>
  html { background: #d9d9d0; }
  body { color: #111; background: #d9d9d0; font-family: "Courier New", Courier, monospace; margin: 0; padding: 24px; line-height: 1.5; }
  main { max-width: 660px; margin: 0 auto; background: #fbfbf5; border: 2px solid #111; padding: 26px 32px 34px; }
  h1 { font-size: 20px; letter-spacing: 3px; margin: 0 0 4px; }
  .sub { font-size: 11px; letter-spacing: 1px; text-transform: uppercase; border-bottom: 2px solid #111; padding-bottom: 14px; margin-bottom: 18px; }
  h2 { font-size: 12px; letter-spacing: 1px; text-transform: uppercase; margin: 24px 0 6px; border-top: 1px solid #a9a9a0; padding-top: 14px; }
  ol, ul { margin: 6px 0 6px; padding-left: 22px; }
  li { margin: 4px 0; }
  code { background: #ecece4; border: 1px solid #c9c9c0; padding: 0 3px; }
  a { color: #111; }
  p { margin: 6px 0; }
  .fig { border: 1px solid #111; padding: 10px 12px; margin: 12px 0; font-size: 13px; }
</style>
</head><body>
<main>
  <h1>SPINNING WHEEL</h1>
  <div class="sub">StreamElements Custom Widget - Operating Instructions</div>

  <h2>1. Description</h2>
  <p>A wheel of weighted choices. Enter choices, spin, the pointer lands on one.
  Where it lands is where it lands: with magnetism off, the wheel can stop on the
  line between two choices. That counts as no result and requires another spin.</p>

  <h2>2. Files</h2>
  <ul>
    <li><a href="./wheel.js">wheel.js</a> - the widget program.</li>
    <li><a href="./fields.json">fields.json</a> - the settings definition.</li>
  </ul>
  <p>Open each link, then use your browser's Save As, or select all and copy.</p>

  <h2>3. Demo</h2>
  <p>Open the <a href="./demo.html">demo page</a> to see the wheel and spin it.</p>

  <h2>4. Install</h2>
  <ol>
    <li>In StreamElements, open Streaming Tools, then My Overlays. Edit an overlay.</li>
    <li>Click Add Widget, then Static / Custom, then Custom Widget.</li>
    <li>Open the widget editor. Select the JS tab. Remove its contents and paste all of <code>wheel.js</code>.</li>
    <li>Select the Fields tab. Open its code (JSON) editor and paste all of <code>fields.json</code>.</li>
    <li>Save the widget.</li>
    <li>Configure the wheel in the Settings/Fields panel.</li>
  </ol>

  <h2>5. Spinning</h2>
  <p>As the broadcaster or a moderator, type the spin command in chat.
  Default: <code>!spin</code>. Change it in the Fields panel (Spin command).</p>

  <h2>6. Settings</h2>
  <ul>
    <li>Slices: a comma-separated list. Weight a choice with <code>[n]</code> or <code>[n%]</code>, for example <code>Song request [5%]</code>.</li>
    <li>Magnetism: off = raw landing (may land between two choices, then re-spin). on = snap to the landed choice's center.</li>
    <li>Seam band: the width, in degrees, of the on-the-line zone when magnetism is off.</li>
    <li>Also: spin duration, countdown, title, color scheme, center icon, sounds, confetti.</li>
  </ul>

  <h2>7. Notes</h2>
  <ul>
    <li>Runs entirely in the browser. Nothing to host; no server.</li>
    <li>The chat trigger has not been tested against a live StreamElements session. Verify it on your channel; adjust the command if moderator status is reported differently on your platform.</li>
    <li>This is the core wheel. Event triggers (goals, points, channel points, giveaways, danger slices) are not included yet.</li>
  </ul>
</main>
</body></html>
`;
}

// Hosted demo page for GitHub Pages: root-relative ./wheel.js, sample fieldData.
function demoHtml() {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" /><title>Spinning Wheel - Demo</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>body{margin:0;display:grid;place-items:center;min-height:100vh;background:#1b1b22}
  #spin{position:fixed;top:12px;left:12px;z-index:10}
  #back{position:fixed;top:12px;right:12px;z-index:10;color:#b8bdd6;font-family:monospace;font-size:12px}</style>
</head><body>
<button id="spin">Spin</button>
<a id="back" href="./index.html">instructions</a>
<script src="./wheel.js"></script>
<script>
  var fd = { sliceEntries: "Eat a lemon, Song request [5%], Ranked games, Draw subs [10], Push-ups, Mystery", wheelStyle: "halfwheel", wheelTitle: "50 points to spin", spinDuration: 5, magnetism: false, seamBand: 3, centerIcon: "heart", colorScheme: "sweetheart-original" };
  var handle = window.Wheel.mountWidget(document, { fieldData: fd });
  document.getElementById("spin").addEventListener("click", function(){ handle.spin && handle.spin(); });
</script>
</body></html>
`;
}
