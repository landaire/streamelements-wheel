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
  execFileSync(
    "tailwindcss",
    ["-i", "src/styles/tailwind.css", "-o", "dist/chrome.css", "--minify"],
    { stdio: "inherit" },
  );
  const chrome = readFileSync("dist/chrome.css", "utf8");
  const wheel = readFileSync("src/styles/wheel.css", "utf8");
  return chrome + "\n" + wheel;
}

const cssDefine = () => ({ __INLINE_CSS__: JSON.stringify(buildCss()) });

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
  // The playground is the landing page; instructions live in a popup inside it.
  writeFileSync("dist/index.html", demoHtml());
  // Keep old links working: demo.html now redirects to the playground at index.html.
  writeFileSync(
    "dist/demo.html",
    '<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=./index.html"><title>Spinning Wheel</title><a href="./index.html">Spinning Wheel playground</a>',
  );
}

// Instructions shown in the playground's popup. Plain operating-manual style, no
// salesmanship. The boilerplate block is filled in by the page from the live config code.
function instructionsInner() {
  return `
  <h1>SPINNING WHEEL</h1>
  <div class="sub">StreamElements Custom Widget - Operating Instructions</div>

  <h2>1. Description</h2>
  <p>A wheel of weighted choices. Enter choices, spin, the pointer lands on one.
  With magnetism off the wheel can stop on the line between two choices; that counts
  as no result and calls for another spin.</p>

  <h2>2. Install</h2>
  <ol>
    <li>In StreamElements, open an overlay and add a Custom Widget.</li>
    <li>Open the widget editor. In every tab -- HTML, CSS, JS, Fields, Data -- delete all of the contents.</li>
    <li>Paste the boilerplate below into the HTML tab.</li>
    <li>Save the widget.</li>
  </ol>
  <div class="fig">
    <div class="fig-head"><span>Boilerplate</span><button id="copy-boilerplate" type="button" class="mono-btn">Copy</button></div>
    <pre id="boilerplate-code" class="code-block"></pre>
  </div>

  <h2>3. Configure</h2>
  <p>Build the look you want in this playground, then press <b>Copy config code</b> in the
  panel. The Copy button above bakes that code into the boilerplate for you. To change the
  wheel later, edit here, copy again, and paste the new boilerplate. An empty code shows the
  default wheel.</p>

  <h2>4. Spinning</h2>
  <ul>
    <li><code>!wheel</code> spins the wheel.</li>
    <li><code>!wheel add &lt;text&gt;</code>, <code>!wheel remove &lt;text&gt;</code>, <code>!wheel reset</code>, <code>!wheel list</code>.</li>
    <li>Only the broadcaster may use these by default. Widen it with Command permission in the config.</li>
  </ul>

  <h2>5. Notes</h2>
  <ul>
    <li>Runs entirely local in the browser, no central server or selfhosting necessary.</li>
    <li>Works as an OBS Browser Source too: save the boilerplate as an .html file and point a source at it. Click the wheel to spin.</li>
  </ul>
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
  :root { color-scheme: dark; --stage-left: 700px; }
  * { box-sizing: border-box; }
  html, body { margin: 0; min-height: 100vh; background: #1b1b22; }
  body {
    padding-left: 700px;
    display: grid;
    place-items: center;
    font-family: sans-serif;
  }
  .wheel-error { color: #fff; font-family: monospace; padding: 20px; max-width: 460px; }
  #panel {
    position: fixed;
    top: 0;
    left: 0;
    width: 700px;
    height: 100vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: rgba(24, 22, 30, 0.92);
    color: #e9e8f2;
    border-right: 1px solid rgba(255, 255, 255, 0.08);
    z-index: 20;
  }
  #panel-head {
    flex: 0 0 auto;
    background: rgba(24, 22, 30, 0.98);
    padding: 16px 18px 14px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
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
  /* Vertical tabs: a fixed tab column on the left, one group's settings shown at a time. */
  #panel-body { flex: 1 1 auto; display: flex; min-height: 0; }
  #tabnav { flex: 0 0 168px; overflow-y: auto; border-right: 1px solid rgba(255, 255, 255, 0.1); padding: 8px 0; }
  #tabpanels { flex: 1 1 auto; overflow-y: auto; min-width: 0; padding: 12px 18px 28px; }
  .tab { display: block; width: 100%; text-align: left; background: none; border: none; border-left: 3px solid transparent; color: #b8bdd6; padding: 8px 12px; font-size: 12px; cursor: pointer; }
  .tab:hover { background: rgba(255, 255, 255, 0.05); color: #fff; }
  .tab.active { background: rgba(107, 75, 216, 0.18); color: #fff; border-left-color: #6b4bd8; }
  .f-group { display: none; }
  .f-group.active { display: block; }
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
  .f-file { display: flex; align-items: center; gap: 8px; margin-top: 6px; flex-wrap: wrap; }
  .f-file-btn { font-family: inherit; font-size: 12px; background: #2a2836; color: #cfcde0; border: 1px solid #4a4760; border-radius: 5px; padding: 5px 12px; cursor: pointer; }
  .f-file-btn:hover { background: #34313f; }
  .f-file-status { font-size: 11px; color: #8b88a8; line-height: 1.35; word-break: break-word; flex: 1 1 120px; min-width: 0; }
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
  /* Share bar: config URL + code with actions. */
  #share-bar { margin-top: 12px; display: grid; gap: 5px; }
  #share-bar label { font-size: 10px; letter-spacing: 0.5px; text-transform: uppercase; color: #8b88a8; }
  #share-bar input { width: 100%; background: #2a2836; color: #f1f0f7; border: 1px solid #4a4760; border-radius: 5px; padding: 6px 8px; font-size: 12px; font-family: "Courier New", Courier, monospace; }
  .share-actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 2px; }
  .act-btn { flex: 1 1 auto; background: #2a2836; color: #cfcde0; border: 1px solid #4a4760; border-radius: 7px; padding: 7px 10px; font-size: 12px; cursor: pointer; white-space: nowrap; }
  .act-btn:hover { background: #35323f; color: #fff; }
  .act-btn.primary { background: #6b4bd8; color: #fff; border-color: #6b4bd8; }
  .act-btn.primary:hover { background: #7a5be6; }
  #open-instructions { background: none; color: #b8bdd6; border: none; font-family: monospace; font-size: 12px; cursor: pointer; text-decoration: underline; padding: 0; margin-top: 10px; }
  /* Instructions popup. */
  #modal-overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.55); z-index: 50; display: flex; align-items: flex-start; justify-content: center; padding: 40px 16px; overflow-y: auto; }
  #modal-overlay.hidden { display: none; }
  #modal { max-width: 680px; width: 100%; background: #fbfbf5; color: #111; border: 2px solid #111; font-family: "Courier New", Courier, monospace; line-height: 1.5; padding: 26px 32px 34px; position: relative; }
  #modal h1 { font-size: 20px; letter-spacing: 3px; margin: 0 0 4px; }
  #modal .sub { font-size: 11px; letter-spacing: 1px; text-transform: uppercase; border-bottom: 2px solid #111; padding-bottom: 14px; margin-bottom: 18px; }
  #modal h2 { font-size: 12px; letter-spacing: 1px; text-transform: uppercase; margin: 24px 0 6px; border-top: 1px solid #a9a9a0; padding-top: 14px; }
  #modal ol, #modal ul { margin: 6px 0; padding-left: 22px; }
  #modal li { margin: 4px 0; }
  #modal p { margin: 6px 0; }
  #modal code { background: #ecece4; border: 1px solid #c9c9c0; padding: 0 3px; }
  #modal .fig { border: 1px solid #111; padding: 10px 12px; margin: 12px 0; }
  #modal .fig-head { display: flex; align-items: center; justify-content: space-between; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
  #modal .code-block { margin: 0; white-space: pre-wrap; word-break: break-all; font-size: 12px; background: #ecece4; border: 1px solid #c9c9c0; padding: 8px; max-height: 260px; overflow-y: auto; overscroll-behavior: contain; }
  #modal .mono-btn { font-family: inherit; font-size: 11px; background: #111; color: #fbfbf5; border: none; padding: 3px 10px; cursor: pointer; }
  #modal-close { position: absolute; top: 10px; right: 12px; background: #111; color: #fbfbf5; border: none; font-family: inherit; font-size: 12px; padding: 4px 10px; cursor: pointer; }
</style>
</head><body>
<div id="panel">
  <div id="panel-head">
    <h1>Wheel Settings Playground</h1>
    <button id="spin" type="button">Spin the Wheel</button>
    <div id="share-bar">
      <label for="config-url">Config URL</label>
      <input id="config-url" type="text" spellcheck="false" placeholder="paste a URL, press Enter to load" />
      <label for="config-code">Config code (copy this, or paste one here to import)</label>
      <input id="config-code" type="text" spellcheck="false" placeholder="paste a config code here, then press Enter or Import" />
      <div class="share-actions">
        <button id="copy-config" type="button" class="act-btn primary">Copy config code</button>
        <button id="paste-config" type="button" class="act-btn primary">Import config code</button>
        <button id="share" type="button" class="act-btn">Copy share link</button>
      </div>
      <div id="share-status"></div>
    </div>
    <button id="open-instructions" type="button">How to install in StreamElements</button>
  </div>
  <div id="panel-body">
    <div id="tabnav"></div>
    <div id="tabpanels"></div>
  </div>
</div>
<div id="modal-overlay" class="hidden">
  <div id="modal">
    <button id="modal-close" type="button">Close</button>
    ${instructionsInner()}
  </div>
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

  // The comma list and the editor item list are the same items. These convert between them
  // so they stay in sync until categories are added.
  var SLICE_WEIGHT_RE = /\\[\\s*([0-9]*\\.?[0-9]+)\\s*(%)?\\s*\\]\\s*$/;
  function sliceTextToItems(text) {
    return String(text == null ? "" : text)
      .split(",")
      .map(function (p) { return p.trim(); })
      .filter(function (p) { return p.length > 0; })
      .map(function (entry) {
        var m = SLICE_WEIGHT_RE.exec(entry);
        var t = entry, weight = 1, pct = false;
        if (m) { t = entry.slice(0, m.index).trim(); weight = Number(m[1]); pct = m[2] === "%"; }
        return { uid: genItemUid(), text: t, weight: weight, categoryId: "", pct: pct };
      });
  }
  function itemsToSliceText(items) {
    return items
      .map(function (it) {
        var w = "";
        if (it.pct) w = " [" + it.weight + "%]";
        else if (it.weight !== 1) w = " [" + it.weight + "]";
        return it.text + w;
      })
      .join(", ");
  }
  function sliceEntriesDefault() {
    var f = FIELD_DEFS.filter(function (x) { return x.key === "sliceEntries"; })[0];
    return f ? f.value : "";
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
  function loadEditor() {
    var raw = hashFieldData.advancedConfig;
    if (typeof raw === "string" && raw) {
      try {
        var parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.categories) && Array.isArray(parsed.items)) {
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
              pct: false,
            };
          });
          return;
        }
      } catch (e) {
        // malformed advancedConfig: fall through to seeding from the comma list
      }
    }
    // No categories/advanced config: the item list mirrors the comma slice list.
    var sliceText = Object.prototype.hasOwnProperty.call(hashFieldData, "sliceEntries")
      ? hashFieldData.sliceEntries
      : sliceEntriesDefault();
    editorState.items = sliceTextToItems(sliceText);
  }
  loadEditor();

  function makeLabel(text) {
    var d = document.createElement("div");
    d.className = "f-label";
    d.textContent = text;
    return d;
  }

  var groupOrder = [];
  function groupSlug(name) {
    return "group-" + name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }
  var tabpanels = document.getElementById("tabpanels");
  function groupBody(name) {
    if (groupBodies[name]) return groupBodies[name];
    var wrap = document.createElement("div");
    wrap.className = "f-group";
    wrap.id = groupSlug(name);
    var h = document.createElement("h3");
    h.textContent = name;
    wrap.appendChild(h);
    var body = document.createElement("div");
    body.className = "f-group-body";
    wrap.appendChild(body);
    tabpanels.appendChild(wrap);
    groupBodies[name] = body;
    groupOrder.push(name);
    return body;
  }

  function scheduleRemount(delayMs) {
    if (remountTimer !== null) clearTimeout(remountTimer);
    remountTimer = setTimeout(remountWheel, delayMs);
  }

  function humanSize(chars) {
    var kb = chars / 1024;
    return kb >= 1024 ? (Math.round(kb / 102.4) / 10) + " MB" : Math.round(kb) + " KB";
  }

  // A "Choose file..." control that reads the picked file as a base64 data URL and drops it
  // straight into the field, so users never hand-encode an image or sound. The encoded string
  // rides along in the config code like any other field value.
  function makeFilePicker(field, targetInput) {
    var wrap = document.createElement("div");
    wrap.className = "f-file";
    var fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = field.accept;
    fileInput.style.display = "none";
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "f-file-btn";
    btn.textContent = "Choose file...";
    var status = document.createElement("span");
    status.className = "f-file-status";
    btn.addEventListener("click", function () { fileInput.click(); });
    fileInput.addEventListener("change", function () {
      var file = fileInput.files && fileInput.files[0];
      if (!file) return;
      status.textContent = "Encoding " + file.name + "...";
      var reader = new FileReader();
      reader.onerror = function () { status.textContent = "Could not read that file."; };
      reader.onload = function () {
        var dataUrl = typeof reader.result === "string" ? reader.result : "";
        if (!dataUrl) { status.textContent = "Could not read that file."; return; }
        targetInput.value = dataUrl;
        status.textContent = "Embedded " + file.name + " (" + humanSize(dataUrl.length) + ")";
        if (dataUrl.length > 1400000) status.textContent += " -- large, your config code will be big";
        remountWheel();
        fileInput.value = ""; // let the same file be re-picked
      };
      reader.readAsDataURL(file);
    });
    wrap.appendChild(btn);
    wrap.appendChild(fileInput);
    wrap.appendChild(status);
    return wrap;
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
      if (field.accept) row.appendChild(makeFilePicker(field, input));
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

  var editorGroupBody = groupBody("Wheel Slices");
  editorGroupBody.insertAdjacentHTML(
    "beforeend",
    '<div class="ed-intro">The items below mirror the comma list above and stay in sync. ' +
      "Add categories to give items two-level odds (category share x item share); until then " +
      "the simple comma list drives the wheel.</div>" +
      '<details class="editor-section" open>' +
      "<summary>Items</summary>" +
      '<div id="ed-item-list" class="ed-list"></div>' +
      '<div class="ed-add-row">' +
      '<button id="ed-add-item" type="button" class="ed-add-btn">Add item</button>' +
      '<button id="ed-shuffle" type="button" class="ed-add-btn">Shuffle</button>' +
      "</div>" +
      "</details>" +
      '<details class="editor-section">' +
      "<summary>Categories</summary>" +
      '<div id="ed-cat-list" class="ed-list"></div>' +
      '<button id="ed-add-cat" type="button" class="ed-add-btn">Add category</button>' +
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
      hint.textContent = "No items. Type in the comma list above to populate this list.";
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

  // Two-way sync between the comma slice list and the item editor (while there are no
  // categories). Editing the comma field repopulates the item list; editing items writes
  // back to the comma field. A set of categories switches to the advancedConfig path.
  function syncSliceFieldFromItems() {
    if (!controls.sliceEntries) return;
    if (editorState.categories.length > 0) return;
    if (document.activeElement === controls.sliceEntries.el) return; // do not clobber typing
    controls.sliceEntries.el.value = itemsToSliceText(editorState.items);
  }
  if (controls.sliceEntries) {
    controls.sliceEntries.el.addEventListener("input", function () {
      editorState.items = sliceTextToItems(controls.sliceEntries.el.value);
      renderItems();
      // the generic text listener already scheduled a remount
    });
  }
  // The visual item list replaces the raw advancedConfig JSON in the playground.
  if (controls.advancedConfig) controls.advancedConfig.row.style.display = "none";
  // In the playground, the Import config code field loads the code into every control (via a
  // reload) so you can then edit it, rather than overriding the controls at runtime. Pressing
  // Enter applies it; collectFieldData drops the raw value so it never overrides the controls.
  if (controls.importConfig) {
    controls.importConfig.el.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && controls.importConfig.el.value.trim()) applyCode(controls.importConfig.el.value);
    });
  }

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
    // In the playground, importConfig is a load-into-editor trigger (see its Enter handler),
    // not a runtime override -- so the individual controls always drive the preview.
    data.importConfig = "";
    // Categories present -> two-level odds via advancedConfig. Otherwise the comma list
    // drives the wheel, and the item list is just its synced view: clear advancedConfig and
    // derive sliceEntries from the items.
    if (editorState.categories.length > 0) {
      data.advancedConfig = JSON.stringify(serializeEditor());
    } else {
      data.advancedConfig = "";
      if (editorState.items.length > 0) data.sliceEntries = itemsToSliceText(editorState.items);
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
    syncSliceFieldFromItems();
    var fieldData = collectFieldData();
    var result = window.Wheel.mountWidget(document, { fieldData: fieldData });
    currentHandle = result && "spin" in result ? result : null;
    renderWeights(fieldData);
    syncHash(fieldData);
    updateShareBar();
  }

  document.getElementById("spin").addEventListener("click", function () {
    if (currentHandle && currentHandle.spin) currentHandle.spin();
  });

  function copyToClipboard(text, okMsg) {
    var status = document.getElementById("share-status");
    if (!navigator.clipboard || !navigator.clipboard.writeText) {
      if (status) status.textContent = "Clipboard unavailable";
      return;
    }
    navigator.clipboard.writeText(text).then(
      function () {
        if (status) status.textContent = okMsg;
        setTimeout(function () { if (status) status.textContent = ""; }, 1800);
      },
      function () {
        if (status) status.textContent = "Copy failed";
      },
    );
  }

  // The one-paste StreamElements install: the current config code baked into the loader
  // boilerplate, with a comment pointing back to the playground to edit it.
  function boilerplateText(code) {
    var editUrl = "https://landaire.github.io/streamelements-wheel/";
    return '<script>\\n' +
      '  // Edit this wheel at ' + editUrl + '\\n' +
      '  // then paste the new code between the quotes below.\\n' +
      '  window.WHEEL_CONFIG = "' + code + '";\\n' +
      '<\\/script>\\n' +
      '<script src="' + editUrl + 'wheel.js"><\\/script>';
  }

  // Extracts the base64url code from a raw code or a full URL (anything after the last '#').
  function normalizeCode(input) {
    var s = (input || "").trim();
    var h = s.lastIndexOf("#");
    return h >= 0 ? s.slice(h + 1) : s;
  }

  // Loads a config code by putting it in the hash and reloading, so every control and the
  // visual editor rehydrate through the same path a shared link uses.
  function applyCode(input) {
    var code = normalizeCode(input);
    if (code) location.hash = "#" + code;
    else history.replaceState(null, "", location.pathname + location.search);
    location.reload();
  }

  function updateShareBar() {
    var code = location.hash.replace(/^#/, "");
    var urlEl = document.getElementById("config-url");
    var codeEl = document.getElementById("config-code");
    var bpEl = document.getElementById("boilerplate-code");
    if (urlEl && document.activeElement !== urlEl) urlEl.value = location.href;
    if (codeEl && document.activeElement !== codeEl) codeEl.value = code;
    if (bpEl) bpEl.textContent = boilerplateText(code);
  }

  document.getElementById("share").addEventListener("click", function () {
    copyToClipboard(location.href, "Share link copied!");
  });

  document.getElementById("copy-config").addEventListener("click", function () {
    var code = location.hash.replace(/^#/, "");
    if (!code) {
      var status = document.getElementById("share-status");
      if (status) status.textContent = "All defaults -- no code needed";
      return;
    }
    copyToClipboard(code, "Config code copied!");
  });

  document.getElementById("paste-config").addEventListener("click", function () {
    var status = document.getElementById("share-status");
    var fromField = document.getElementById("config-code").value.trim();
    if (fromField) { applyCode(fromField); return; } // import whatever is in the box first
    // box empty: pull the code from the clipboard
    if (navigator.clipboard && navigator.clipboard.readText) {
      navigator.clipboard.readText().then(
        function (text) {
          if (text && text.trim()) applyCode(text);
          else if (status) status.textContent = "Paste a config code into the box, then Import";
        },
        function () { if (status) status.textContent = "Paste a config code into the box, then Import"; }
      );
    } else if (status) {
      status.textContent = "Paste a config code into the box, then Import";
    }
  });

  document.getElementById("config-code").addEventListener("keydown", function (e) {
    if (e.key === "Enter") applyCode(this.value);
  });
  document.getElementById("config-url").addEventListener("keydown", function (e) {
    if (e.key === "Enter") applyCode(this.value);
  });

  // Instructions popup.
  var overlay = document.getElementById("modal-overlay");
  document.getElementById("open-instructions").addEventListener("click", function () {
    updateShareBar();
    overlay.classList.remove("hidden");
  });
  document.getElementById("modal-close").addEventListener("click", function () {
    overlay.classList.add("hidden");
  });
  overlay.addEventListener("click", function (e) {
    if (e.target === overlay) overlay.classList.add("hidden");
  });
  document.getElementById("copy-boilerplate").addEventListener("click", function () {
    copyToClipboard(boilerplateText(location.hash.replace(/^#/, "")), "Boilerplate copied!");
  });

  // Vertical tabs: one settings group visible at a time, selected from the tab column.
  function activateTab(name) {
    groupOrder.forEach(function (g) {
      var panel = document.getElementById(groupSlug(g));
      if (panel) panel.classList.toggle("active", g === name);
    });
    var tabs = document.querySelectorAll("#tabnav .tab");
    tabs.forEach(function (t) { t.classList.toggle("active", t.dataset.group === name); });
    document.getElementById("tabpanels").scrollTop = 0;
  }
  function buildTabs() {
    var nav = document.getElementById("tabnav");
    nav.innerHTML = "";
    groupOrder.forEach(function (name) {
      var tab = document.createElement("button");
      tab.type = "button";
      tab.className = "tab";
      tab.dataset.group = name;
      tab.textContent = name;
      tab.addEventListener("click", function () { activateTab(name); });
      nav.appendChild(tab);
    });
    if (groupOrder.length > 0) activateTab(groupOrder[0]);
  }

  buildTabs();
  remountWheel();
})();
</script>
</body></html>
`;
}
