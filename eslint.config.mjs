import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),

  /**
   * lawpass_server is a CommonJS Node/Express service, not part of the Next
   * bundle. Its files are `"use strict"` + `require()` + `module.exports`, run
   * directly by Node, and that is the correct module format for them.
   *
   * eslint-config-next turns on @typescript-eslint/no-require-imports for every
   * file it sees. That rule is there to stop `require()` leaking into
   * TypeScript and ESM code, where `import` is the right form — a good rule for
   * the app, and a false positive 268 times over in a directory that is
   * deliberately CommonJS. Silencing it here is narrower than the alternatives:
   * converting the backend to ESM would touch every file in it for no benefit,
   * and ignoring the directory outright would give up the rules that do catch
   * real defects there.
   *
   * Scoped to .js so any .ts or .mjs added under lawpass_server later is still
   * held to the app's rules.
   */
  {
    files: ["lawpass_server/**/*.js"],
    languageOptions: {
      sourceType: "commonjs",
    },
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
]);

export default eslintConfig;
