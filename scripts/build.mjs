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

// Hosted demo page for GitHub Pages: root-relative ./wheel.js. A settings playground --
// one control per window.Wheel.FIELD_DEFS entry, generated dynamically so it can never
// drift out of sync with the field schema. Changing a control re-mounts the wheel live.
function demoHtml() {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" /><title>Spinning Wheel - Demo</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  html, body { margin: 0; min-height: 100vh; background: #1b1b22; }
  body {
    padding-left: 380px;
    display: grid;
    place-items: center;
    font-family: sans-serif;
  }
  .wheel-error { color: #fff; font-family: monospace; padding: 20px; max-width: 460px; }
  #panel {
    position: fixed;
    top: 0;
    left: 0;
    width: 380px;
    height: 100vh;
    overflow-y: auto;
    background: rgba(24, 22, 30, 0.92);
    color: #e9e8f2;
    border-right: 1px solid rgba(255, 255, 255, 0.08);
    z-index: 20;
  }
  #panel-head {
    position: sticky;
    top: 0;
    background: rgba(24, 22, 30, 0.98);
    padding: 16px 18px 14px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    z-index: 1;
  }
  #panel-head h1 { font-size: 15px; margin: 0 0 10px; letter-spacing: 0.5px; }
  #spin {
    display: block;
    width: 100%;
    background: #ff8fa3;
    color: #1b1b22;
    border: none;
    border-radius: 8px;
    padding: 12px 18px;
    font-weight: 700;
    font-size: 15px;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
  }
  #spin:hover { background: #ffa8b8; }
  #back { display: inline-block; margin-top: 10px; color: #b8bdd6; font-family: monospace; font-size: 12px; }
  #panel-body { padding: 6px 18px 24px; }
  .f-group { margin-top: 18px; }
  .f-group h3 {
    font-size: 11px;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: #9a97b8;
    margin: 0 0 8px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    padding-bottom: 4px;
  }
  .f-row { margin-bottom: 10px; }
  .f-label { font-size: 12px; color: #cfcde0; margin-bottom: 4px; }
  .f-row-inline .f-check-label { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #cfcde0; cursor: pointer; }
  .f-row input[type="text"],
  .f-row input[type="number"],
  .f-row select {
    width: 100%;
    background: #2a2836;
    color: #f1f0f7;
    border: 1px solid #4a4760;
    border-radius: 5px;
    padding: 7px 8px;
    font-size: 13px;
    font-family: inherit;
  }
  .f-row input[type="text"] { font-family: "Courier New", Courier, monospace; }
  .f-row input[type="checkbox"] { width: 16px; height: 16px; }
  .f-row input[type="color"] { width: 100%; height: 32px; border: 1px solid #4a4760; border-radius: 5px; background: #2a2836; padding: 2px; }
  .f-slider-wrap { display: flex; align-items: center; gap: 10px; }
  .f-slider-wrap input[type="range"] { flex: 1; }
  .f-slider-val { font-family: "Courier New", Courier, monospace; font-size: 12px; color: #cfcde0; min-width: 3.5em; text-align: right; }
</style>
</head><body>
<div id="panel">
  <div id="panel-head">
    <h1>Wheel Settings Playground</h1>
    <button id="spin" type="button">Spin the Wheel</button>
    <a id="back" href="./index.html">instructions</a>
  </div>
  <div id="panel-body"></div>
</div>
<script src="./wheel.js"></script>
<script>
(function () {
  var FIELD_DEFS = window.Wheel.FIELD_DEFS;
  var panelBody = document.getElementById("panel-body");
  var groupBodies = {};
  var controls = {};
  var remountTimer = null;
  var currentHandle = null;

  function makeLabel(text) {
    var d = document.createElement("div");
    d.className = "f-label";
    d.textContent = text;
    return d;
  }

  function groupBody(name) {
    if (groupBodies[name]) return groupBodies[name];
    var wrap = document.createElement("div");
    wrap.className = "f-group";
    var h = document.createElement("h3");
    h.textContent = name;
    wrap.appendChild(h);
    var body = document.createElement("div");
    wrap.appendChild(body);
    panelBody.appendChild(wrap);
    groupBodies[name] = body;
    return body;
  }

  function scheduleRemount(delayMs) {
    if (remountTimer !== null) clearTimeout(remountTimer);
    remountTimer = setTimeout(remountWheel, delayMs);
  }

  FIELD_DEFS.forEach(function (field) {
    var body = groupBody(field.group);
    var row = document.createElement("div");
    row.className = "f-row";
    var input;

    if (field.type === "checkbox") {
      row.className += " f-row-inline";
      var lbl = document.createElement("label");
      lbl.className = "f-check-label";
      input = document.createElement("input");
      input.type = "checkbox";
      input.checked = Boolean(field.value);
      input.addEventListener("change", remountWheel);
      lbl.appendChild(input);
      var span = document.createElement("span");
      span.textContent = field.label;
      lbl.appendChild(span);
      row.appendChild(lbl);
    } else if (field.type === "dropdown") {
      row.appendChild(makeLabel(field.label));
      input = document.createElement("select");
      var opts = field.options || {};
      Object.keys(opts).forEach(function (key) {
        var opt = document.createElement("option");
        opt.value = key;
        opt.textContent = opts[key];
        if (key === field.value) opt.selected = true;
        input.appendChild(opt);
      });
      input.addEventListener("change", remountWheel);
      row.appendChild(input);
    } else if (field.type === "slider") {
      row.appendChild(makeLabel(field.label));
      var sliderWrap = document.createElement("div");
      sliderWrap.className = "f-slider-wrap";
      input = document.createElement("input");
      input.type = "range";
      input.min = String(field.min);
      input.max = String(field.max);
      input.step = String(field.step || 1);
      input.value = String(field.value);
      var out = document.createElement("span");
      out.className = "f-slider-val";
      out.textContent = String(field.value);
      input.addEventListener("input", function () {
        out.textContent = input.value;
        scheduleRemount(250);
      });
      sliderWrap.appendChild(input);
      sliderWrap.appendChild(out);
      row.appendChild(sliderWrap);
    } else if (field.type === "colorpicker") {
      row.appendChild(makeLabel(field.label));
      input = document.createElement("input");
      input.type = "color";
      input.value = typeof field.value === "string" && field.value ? field.value : "#ffffff";
      input.addEventListener("input", function () { scheduleRemount(250); });
      row.appendChild(input);
    } else if (field.type === "number") {
      row.appendChild(makeLabel(field.label));
      input = document.createElement("input");
      input.type = "number";
      input.value = String(field.value);
      input.addEventListener("input", function () { scheduleRemount(250); });
      row.appendChild(input);
    } else {
      // text, sound-input
      row.appendChild(makeLabel(field.label));
      input = document.createElement("input");
      input.type = "text";
      input.value = field.value === undefined ? "" : String(field.value);
      input.addEventListener("input", function () { scheduleRemount(250); });
      row.appendChild(input);
    }

    body.appendChild(row);
    controls[field.key] = { field: field, el: input };
  });

  function readValue(entry) {
    if (entry.field.type === "checkbox") return entry.el.checked;
    if (entry.field.type === "number" || entry.field.type === "slider") return Number(entry.el.value);
    return entry.el.value;
  }

  function collectFieldData() {
    var data = {};
    Object.keys(controls).forEach(function (key) {
      data[key] = readValue(controls[key]);
    });
    return data;
  }

  function remountWheel() {
    document.querySelectorAll(".wheel-container, .wheel-error").forEach(function (e) { e.remove(); });
    var result = window.Wheel.mountWidget(document, { fieldData: collectFieldData() });
    currentHandle = result && "spin" in result ? result : null;
  }

  document.getElementById("spin").addEventListener("click", function () {
    if (currentHandle && currentHandle.spin) currentHandle.spin();
  });

  remountWheel();
})();
</script>
</body></html>
`;
}
