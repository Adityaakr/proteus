import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

// The seller page tests (test/*.test.tsx) render site components with the site's own React, router and query client,
// so they resolve to one copy whether imported here or from site files.
const site = (p: string) => resolve(import.meta.dirname, "../site/node_modules", p);

export default defineConfig({
  resolve: {
    alias: {
      react: site("react"),
      "react-dom": site("react-dom"),
      "react-router-dom": site("react-router-dom"),
      "@tanstack/react-query": site("@tanstack/react-query"),
    },
  },
  test: { include: ["test/**/*.test.ts", "test/**/*.test.tsx"] },
});
