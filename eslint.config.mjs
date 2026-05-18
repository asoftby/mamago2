import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",

    "node_modules/**",
    ".claude/**",
    ".turbo/**",
    "coverage/**",
    "dist/**",
  ]),
  ...nextVitals,
  ...nextTs,
]);

export default eslintConfig;
