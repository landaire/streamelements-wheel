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
  .f-color-wrap { display: flex; gap: 8px; align-items: center; }
  .f-color-wrap input[type="color"] { width: 46px; height: 32px; flex: 0 0 auto; border: 1px solid #4a4760; border-radius: 5px; background: #2a2836; padding: 2px; }
  .f-color-wrap input.f-hex { flex: 1 1 auto; text-transform: lowercase; }
  .f-slider-wrap { display: flex; align-items: center; gap: 10px; }
  .f-slider-wrap input[type="range"] { flex: 1; }
  .f-slider-val { font-family: "Courier New", Courier, monospace; font-size: 12px; color: #cfcde0; min-width: 3.5em; text-align: right; }
  .f-hint { font-size: 11px; color: #8b88a8; margin-top: 4px; line-height: 1.35; }
  #share {
    display: block;
    width: 100%;
    margin-top: 8px;
    background: #2a2836;
    color: #cfcde0;
    border: 1px solid #4a4760;
    border-radius: 8px;
    padding: 8px 14px;
    font-size: 12px;
    cursor: pointer;
  }
  #share:hover { background: #35323f; }
  #share-status { font-size: 11px; color: #8b88a8; margin-top: 4px; min-height: 14px; }
  #weights-readout { font-family: "Courier New", Courier, monospace; font-size: 12px; color: #cfcde0; line-height: 1.5; }
  .ed-intro { font-size: 11px; color: #8b88a8; margin: 0 0 10px; line-height: 1.4; }
  .editor-section { margin-bottom: 4px; }
  .editor-section summary { cursor: pointer; font-size: 12px; font-weight: 600; color: #cfcde0; padding: 6px 0; }
  .ed-list { max-height: 240px; overflow-y: auto; padding-right: 4px; margin: 4px 0 8px; }
  .ed-hint { font-size: 11px; color: #8b88a8; padding: 4px 0; }
  .ed-row { background: #221f2c; border: 1px solid #3a3750; border-radius: 6px; padding: 8px; margin-bottom: 6px; }
  .ed-row-controls { display: flex; gap: 6px; margin-top: 6px; align-items: center; }
  .ed-input { background: #2a2836; color: #f1f0f7; border: 1px solid #4a4760; border-radius: 5px; padding: 6px 7px; font-size: 12px; font-family: inherit; }
  .ed-input-wide { width: 100%; box-sizing: border-box; }
  .ed-input-num { width: 58px; flex: none; }
  .ed-color { width: 34px; height: 28px; padding: 2px; flex: none; }
  .ed-select { flex: 1; min-width: 0; }
  .ed-btn { background: #2a2836; color: #cfcde0; border: 1px solid #4a4760; border-radius: 5px; padding: 5px 8px; font-size: 11px; cursor: pointer; flex: none; }
  .ed-btn:hover { background: #35323f; }
  .ed-btn:disabled { opacity: 0.4; cursor: default; }
  .ed-btn-remove { color: #ff9f9f; border-color: #6a3a3a; margin-left: auto; }
  .ed-add-row { display: flex; gap: 8px; margin-top: 4px; }
  .ed-add-btn { flex: 1; background: #2a2836; color: #cfcde0; border: 1px solid #4a4760; border-radius: 6px; padding: 8px 10px; font-size: 12px; cursor: pointer; }
  .ed-add-btn:hover { background: #35323f; }
</style>
</head><body>
<div id="panel">
  <div id="panel-head">
    <h1>Wheel Settings Playground</h1>
    <button id="spin" type="button">Spin the Wheel</button>
    <button id="share" type="button">Copy share link</button>
    <div id="share-status"></div>
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

  var editorState = { categories: [], items: [] };
  var editorCatSeq = 0;
  var editorItemSeq = 0;
  var DEFAULT_CAT_COLORS = ["#ff8fa3", "#8fd6ff", "#c9a0ff", "#ffd98f", "#8fffb0", "#ff9f8f"];
  var catListEl = null;
  var itemListEl = null;

  function genCatId() {
    editorCatSeq += 1;
    return "cat-" + editorCatSeq + "-" + Math.random().toString(36).slice(2, 7);
  }
  function genItemUid() {
    editorItemSeq += 1;
    return "item-" + editorItemSeq + "-" + Math.random().toString(36).slice(2, 7);
  }

  // base64url = base64 with +/ -> -/_ and = padding stripped. encodeURIComponent/
  // decodeURIComponent + escape/unescape round-trips UTF-8 through btoa/atob, which
  // only accept Latin1.
  function toBase64Url(str) {
    var b64 = btoa(unescape(encodeURIComponent(str)));
    return b64.replace(/\\+/g, "-").replace(/\\//g, "_").replace(/=+$/, "");
  }
  function fromBase64Url(str) {
    var b64 = str.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    return decodeURIComponent(escape(atob(b64)));
  }

  function loadFieldDataFromHash() {
    var hash = location.hash.replace(/^#/, "");
    if (!hash) return null;
    try {
      var data = JSON.parse(fromBase64Url(hash));
      if (data && typeof data === "object") return data;
    } catch (e) {
      // malformed hash: fall back to FIELD_DEFS defaults below
    }
    return null;
  }

  // The hash only ever carries fields that differ from FIELD_DEFS defaults; merge it
  // over the defaults so missing keys fall back rather than reading as undefined.
  var hashFieldData = loadFieldDataFromHash() || {};
  function initialValue(field) {
    return Object.prototype.hasOwnProperty.call(hashFieldData, field.key) ? hashFieldData[field.key] : field.value;
  }

  // Populates the visual editor from a hash-carried advancedConfig JSON, so a shared
  // link with categories/items reopens with the editor pre-filled, not just the raw
  // text field.
  function loadEditorFromHash() {
    var raw = hashFieldData.advancedConfig;
    if (typeof raw !== "string" || !raw) return;
    try {
      var parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.categories) || !Array.isArray(parsed.items)) return;
      editorState.categories = parsed.categories.map(function (c) {
        return {
          id: String(c.id),
          name: typeof c.name === "string" ? c.name : String(c.id),
          weight: Number(c.weight),
          color: typeof c.color === "string" && c.color ? c.color : "#ff8fa3",
        };
      });
      editorState.items = parsed.items.map(function (it) {
        return {
          uid: genItemUid(),
          text: typeof it.text === "string" ? it.text : "",
          weight: Number(it.weight),
          categoryId: typeof it.categoryId === "string" ? it.categoryId : "",
        };
      });
    } catch (e) {
      // malformed hash advancedConfig: leave the editor empty, simple controls still work
    }
  }
  loadEditorFromHash();

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
    var initVal = initialValue(field);

    if (field.type === "checkbox") {
      row.className += " f-row-inline";
      var lbl = document.createElement("label");
      lbl.className = "f-check-label";
      input = document.createElement("input");
      input.type = "checkbox";
      input.checked = Boolean(initVal);
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
        if (key === initVal) opt.selected = true;
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
      input.value = String(initVal);
      var out = document.createElement("span");
      out.className = "f-slider-val";
      out.textContent = String(initVal);
      input.addEventListener("input", function () {
        out.textContent = input.value;
        scheduleRemount(250);
      });
      sliderWrap.appendChild(input);
      sliderWrap.appendChild(out);
      row.appendChild(sliderWrap);
    } else if (field.type === "colorpicker") {
      row.appendChild(makeLabel(field.label));
      var colorWrap = document.createElement("div");
      colorWrap.className = "f-color-wrap";
      input = document.createElement("input");
      input.type = "color";
      input.value = typeof initVal === "string" && initVal ? initVal : "#ffffff";
      var hex = document.createElement("input");
      hex.type = "text";
      hex.className = "f-hex";
      hex.value = input.value;
      hex.spellcheck = false;
      hex.maxLength = 7;
      // Color swatch and hex text stay in sync; typing a valid #rgb or #rrggbb updates the swatch.
      input.addEventListener("input", function () { hex.value = input.value; scheduleRemount(250); });
      hex.addEventListener("input", function () {
        var v = hex.value.trim();
        if (v[0] !== "#") v = "#" + v;
        var m = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(v);
        if (!m) return;
        var h = m[1];
        if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
        input.value = "#" + h.toLowerCase();
        scheduleRemount(250);
      });
      colorWrap.appendChild(input);
      colorWrap.appendChild(hex);
      row.appendChild(colorWrap);
    } else if (field.type === "number") {
      row.appendChild(makeLabel(field.label));
      input = document.createElement("input");
      input.type = "number";
      input.value = String(initVal);
      input.addEventListener("input", function () { scheduleRemount(250); });
      row.appendChild(input);
    } else {
      // text, sound-input
      row.appendChild(makeLabel(field.label));
      input = document.createElement("input");
      input.type = "text";
      input.value = initVal === undefined ? "" : String(initVal);
      input.addEventListener("input", function () { scheduleRemount(250); });
      row.appendChild(input);
    }

    body.appendChild(row);
    if (field.hint) {
      var hint = document.createElement("div");
      hint.className = "f-hint";
      hint.textContent = field.hint;
      row.appendChild(hint);
    }
    controls[field.key] = { field: field, el: input, row: row };
  });

  // Keep the color panel simple: only the two main colors show in Auto mode; the nine
  // individual pickers show only in Custom mode.
  function syncColorVisibility() {
    var scheme = controls.colorScheme ? controls.colorScheme.el.value : "auto";
    var autoKeys = ["colorPrimary", "colorSecondary"];
    var customKeys = ["colorSliceEven", "colorSliceOdd", "colorSliceBorder", "colorRim", "colorHub", "colorHubInner", "colorPlate", "colorTitle", "colorEntry"];
    autoKeys.forEach(function (k) { if (controls[k]) controls[k].row.style.display = scheme === "auto" ? "" : "none"; });
    customKeys.forEach(function (k) { if (controls[k]) controls[k].row.style.display = scheme === "custom" ? "" : "none"; });
    // Gem color picker applies only when the gem is not matching the scheme.
    var gemMatch = controls.gemMatchScheme ? controls.gemMatchScheme.el.checked : true;
    if (controls.colorGem) controls.colorGem.row.style.display = gemMatch ? "none" : "";
  }
  if (controls.colorScheme) controls.colorScheme.el.addEventListener("change", syncColorVisibility);
  if (controls.gemMatchScheme) controls.gemMatchScheme.el.addEventListener("change", syncColorVisibility);
  syncColorVisibility();

  var editorGroupBody = groupBody("Wheel Editor");
  editorGroupBody.insertAdjacentHTML(
    "beforeend",
    '<div class="ed-intro">Build categories and items visually. Adding at least one item ' +
      "activates two-level odds (category share x item share) and replaces the simple slice " +
      'list above.</div>' +
      '<details class="editor-section" open>' +
      "<summary>Categories</summary>" +
      '<div id="ed-cat-list" class="ed-list"></div>' +
      '<button id="ed-add-cat" type="button" class="ed-add-btn">Add category</button>' +
      "</details>" +
      '<details class="editor-section" open>' +
      "<summary>Items</summary>" +
      '<div id="ed-item-list" class="ed-list"></div>' +
      '<div class="ed-add-row">' +
      '<button id="ed-add-item" type="button" class="ed-add-btn">Add item</button>' +
      '<button id="ed-shuffle" type="button" class="ed-add-btn">Shuffle</button>' +
      "</div>" +
      "</details>",
  );
  catListEl = document.getElementById("ed-cat-list");
  itemListEl = document.getElementById("ed-item-list");

  function buildCategoryOptions(select, selectedId) {
    select.innerHTML = "";
    var noneOpt = document.createElement("option");
    noneOpt.value = "";
    noneOpt.textContent = "(Uncategorized)";
    select.appendChild(noneOpt);
    editorState.categories.forEach(function (cat) {
      var opt = document.createElement("option");
      opt.value = cat.id;
      opt.textContent = cat.name || cat.id;
      select.appendChild(opt);
    });
    select.value = selectedId || "";
  }

  function renderItemCategoryOptions() {
    var selects = itemListEl.querySelectorAll("select.ed-select");
    selects.forEach(function (sel, idx) {
      var item = editorState.items[idx];
      if (item) buildCategoryOptions(sel, item.categoryId);
    });
  }

  function renderCategories() {
    catListEl.innerHTML = "";
    if (editorState.categories.length === 0) {
      var hint = document.createElement("div");
      hint.className = "ed-hint";
      hint.textContent = "No categories yet. Items without a category are Uncategorized.";
      catListEl.appendChild(hint);
    }
    editorState.categories.forEach(function (cat) {
      var row = document.createElement("div");
      row.className = "ed-row";

      var nameInput = document.createElement("input");
      nameInput.type = "text";
      nameInput.className = "ed-input ed-input-wide";
      nameInput.value = cat.name;
      nameInput.addEventListener("input", function () {
        cat.name = nameInput.value;
        renderItemCategoryOptions();
        scheduleRemount(200);
      });

      var controls = document.createElement("div");
      controls.className = "ed-row-controls";

      var weightInput = document.createElement("input");
      weightInput.type = "number";
      weightInput.step = "any";
      weightInput.className = "ed-input ed-input-num";
      weightInput.value = String(cat.weight);
      weightInput.addEventListener("input", function () {
        cat.weight = Number(weightInput.value);
        scheduleRemount(200);
      });

      var colorInput = document.createElement("input");
      colorInput.type = "color";
      colorInput.className = "ed-input ed-color";
      colorInput.value = cat.color;
      colorInput.addEventListener("input", function () {
        cat.color = colorInput.value;
        scheduleRemount(200);
      });

      var removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "ed-btn ed-btn-remove";
      removeBtn.textContent = "Remove";
      removeBtn.addEventListener("click", function () {
        editorState.categories = editorState.categories.filter(function (c) { return c.id !== cat.id; });
        editorState.items.forEach(function (it) {
          if (it.categoryId === cat.id) it.categoryId = "";
        });
        renderCategories();
        renderItems();
        remountWheel();
      });

      controls.appendChild(weightInput);
      controls.appendChild(colorInput);
      controls.appendChild(removeBtn);
      row.appendChild(nameInput);
      row.appendChild(controls);
      catListEl.appendChild(row);
    });
  }

  function renderItems() {
    itemListEl.innerHTML = "";
    if (editorState.items.length === 0) {
      var hint = document.createElement("div");
      hint.className = "ed-hint";
      hint.textContent = "No items yet. The simple slice list above is used until an item is added.";
      itemListEl.appendChild(hint);
    }
    editorState.items.forEach(function (item, idx) {
      var row = document.createElement("div");
      row.className = "ed-row";

      var textInput = document.createElement("input");
      textInput.type = "text";
      textInput.className = "ed-input ed-input-wide";
      textInput.value = item.text;
      textInput.addEventListener("input", function () {
        item.text = textInput.value;
        scheduleRemount(200);
      });

      var controls = document.createElement("div");
      controls.className = "ed-row-controls";

      var weightInput = document.createElement("input");
      weightInput.type = "number";
      weightInput.step = "any";
      weightInput.className = "ed-input ed-input-num";
      weightInput.value = String(item.weight);
      weightInput.addEventListener("input", function () {
        item.weight = Number(weightInput.value);
        scheduleRemount(200);
      });

      var catSelect = document.createElement("select");
      catSelect.className = "ed-input ed-select";
      buildCategoryOptions(catSelect, item.categoryId);
      catSelect.addEventListener("change", function () {
        item.categoryId = catSelect.value;
        remountWheel();
      });

      var upBtn = document.createElement("button");
      upBtn.type = "button";
      upBtn.className = "ed-btn";
      upBtn.textContent = "Up";
      upBtn.disabled = idx === 0;
      upBtn.addEventListener("click", function () {
        if (idx === 0) return;
        var tmp = editorState.items[idx - 1];
        editorState.items[idx - 1] = editorState.items[idx];
        editorState.items[idx] = tmp;
        renderItems();
        remountWheel();
      });

      var downBtn = document.createElement("button");
      downBtn.type = "button";
      downBtn.className = "ed-btn";
      downBtn.textContent = "Down";
      downBtn.disabled = idx === editorState.items.length - 1;
      downBtn.addEventListener("click", function () {
        if (idx === editorState.items.length - 1) return;
        var tmp = editorState.items[idx + 1];
        editorState.items[idx + 1] = editorState.items[idx];
        editorState.items[idx] = tmp;
        renderItems();
        remountWheel();
      });

      var removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "ed-btn ed-btn-remove";
      removeBtn.textContent = "Remove";
      removeBtn.addEventListener("click", function () {
        editorState.items.splice(idx, 1);
        renderItems();
        remountWheel();
      });

      controls.appendChild(weightInput);
      controls.appendChild(catSelect);
      controls.appendChild(upBtn);
      controls.appendChild(downBtn);
      controls.appendChild(removeBtn);
      row.appendChild(textInput);
      row.appendChild(controls);
      itemListEl.appendChild(row);
    });
  }

  document.getElementById("ed-add-cat").addEventListener("click", function () {
    var color = DEFAULT_CAT_COLORS[editorState.categories.length % DEFAULT_CAT_COLORS.length];
    editorState.categories.push({
      id: genCatId(),
      name: "Category " + (editorState.categories.length + 1),
      weight: 1,
      color: color,
    });
    renderCategories();
    renderItems();
    remountWheel();
  });

  document.getElementById("ed-add-item").addEventListener("click", function () {
    editorState.items.push({ uid: genItemUid(), text: "New item", weight: 1, categoryId: "" });
    renderItems();
    remountWheel();
  });

  document.getElementById("ed-shuffle").addEventListener("click", function () {
    var arr = editorState.items;
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    renderItems();
    remountWheel();
  });

  renderCategories();
  renderItems();

  var weightsBody = groupBody("Computed Slice Weights");

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
    // The visual editor is the source of truth for advancedConfig whenever it has at
    // least one item; an empty editor falls back to whatever the raw text field holds
    // (normally "", i.e. the simple sliceEntries path).
    if (editorState.items.length > 0) {
      data.advancedConfig = JSON.stringify(serializeEditor());
    }
    return data;
  }

  function serializeEditor() {
    return {
      categories: editorState.categories.map(function (cat) {
        return { id: cat.id, name: cat.name, weight: cat.weight, color: cat.color };
      }),
      items: editorState.items.map(function (item) {
        var out = { text: item.text, weight: item.weight };
        if (item.categoryId) out.categoryId = item.categoryId;
        return out;
      }),
    };
  }

  function renderWeights(fieldData) {
    weightsBody.innerHTML = "";
    var parsed = window.Wheel.parseConfig(fieldData);
    var readout = document.createElement("div");
    readout.id = "weights-readout";
    if (!parsed || parsed.kind !== "ok") {
      readout.textContent = "(invalid slice config)";
    } else {
      var slices = parsed.value.slices;
      var total = 0;
      slices.forEach(function (s) { total += s.weight; });
      slices.forEach(function (s) {
        var pct = total > 0 ? (s.weight / total) * 100 : 0;
        var row = document.createElement("div");
        row.textContent = s.text + ": " + pct.toFixed(1) + "%";
        readout.appendChild(row);
      });
    }
    weightsBody.appendChild(readout);
  }

  function diffFromDefaults(fieldData) {
    var diff = {};
    FIELD_DEFS.forEach(function (field) {
      if (fieldData[field.key] !== field.value) diff[field.key] = fieldData[field.key];
    });
    return diff;
  }

  function syncHash(fieldData) {
    try {
      var diff = diffFromDefaults(fieldData);
      if (Object.keys(diff).length === 0) {
        history.replaceState(null, "", location.pathname + location.search);
        return;
      }
      var encoded = toBase64Url(JSON.stringify(diff));
      history.replaceState(null, "", "#" + encoded);
    } catch (e) {
      // hash sync is best-effort; never block a remount over it
    }
  }

  function remountWheel() {
    document.querySelectorAll(".wheel-container, .wheel-error").forEach(function (e) { e.remove(); });
    var fieldData = collectFieldData();
    var result = window.Wheel.mountWidget(document, { fieldData: fieldData });
    currentHandle = result && "spin" in result ? result : null;
    renderWeights(fieldData);
    syncHash(fieldData);
  }

  document.getElementById("spin").addEventListener("click", function () {
    if (currentHandle && currentHandle.spin) currentHandle.spin();
  });

  document.getElementById("share").addEventListener("click", function () {
    var status = document.getElementById("share-status");
    if (!navigator.clipboard || !navigator.clipboard.writeText) {
      if (status) status.textContent = "Clipboard unavailable";
      return;
    }
    navigator.clipboard.writeText(location.href).then(
      function () {
        if (status) status.textContent = "Copied!";
        setTimeout(function () { if (status) status.textContent = ""; }, 1500);
      },
      function () {
        if (status) status.textContent = "Copy failed";
      },
    );
  });

  remountWheel();
})();
</script>
</body></html>
`;
}
