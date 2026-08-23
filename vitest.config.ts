import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    environmentMatchGlobs: [["test/**/*.dom.test.ts", "jsdom"]],
  },
});
