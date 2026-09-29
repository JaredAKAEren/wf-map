import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite-plus";

export default defineConfig({
  base: process.env.VITE_WF_PAGES === "1" ? "/wf-map/" : "/",
  plugins: [vue()],
  fmt: { arrowParens: "always", sortImports: true, sortPackageJson: true },
  lint: {
    categories: { correctness: "error", suspicious: "error" },
    options: {
      denyWarnings: true,
      reportUnusedDisableDirectives: "error",
      typeAware: true,
      typeCheck: true,
    },
    plugins: ["import", "vue", "typescript", "unicorn", "vitest"],
    rules: {
      "arrow-body-style": ["error", "always"],
      curly: ["error", "all"],
      "import/no-unassigned-import": ["error", { allow: ["**/*.css"] }],
    },
  },
  test: { include: ["src/**/*.test.ts"], environment: "node" },
  staged: {
    "*.{ts,js,mjs}": "vp check --fix",
    "*.vue": ["vp check --fix", "vp exec stylelint --fix"],
    "*.css": ["vp fmt --write", "vp exec stylelint --fix"],
    "*.{json,md,yaml,yml,html}": "vp fmt --write",
  },
});
