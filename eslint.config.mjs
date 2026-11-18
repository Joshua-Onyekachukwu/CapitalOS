import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import jsxA11y from "eslint-plugin-jsx-a11y";

const a11y = jsxA11y.flatConfigs.recommended;

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // jsx-a11y rules are merged only — eslint-config-next already registers the
  // plugin in `core-web-vitals`, so re-registering it throws "Cannot redefine
  // plugin".
  {
    files: ["src/**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"],
    rules: a11y.rules,
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Repo-specific untracked data / legacy dirs (code-quality audit F10):
    "exports/**",
    "backups/**",
    "outreach-demo/**",
    "investor-intelligence/**",
    "Trezo/**",
    "test-data/**",
    "test-results/**",
    "landing page images/**",
    "output/**",
    ".convex/**",
    "scripts/**",
  ]),
]);

export default eslintConfig;
