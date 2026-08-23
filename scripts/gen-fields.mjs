import * as esbuild from "esbuild";
import { mkdirSync, writeFileSync } from "node:fs";

// Bundle the TS defs to a temp ESM module, import it, serialize the schema.
export async function genFields() {
  const result = await esbuild.build({
    entryPoints: ["src/config/fields.ts"],
    bundle: true,
    format: "esm",
    write: false,
    platform: "node",
  });
  const code = result.outputFiles[0].text;
  const mod = await import("data:text/javascript;base64," + Buffer.from(code).toString("base64"));
  mkdirSync("dist", { recursive: true });
  writeFileSync("dist/fields.json", JSON.stringify(mod.buildFieldsSchema(), null, 2) + "\n");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await genFields();
  console.log("wrote dist/fields.json");
}
