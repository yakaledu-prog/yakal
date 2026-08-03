import js from "@eslint/js";
import globals from "globals";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

// Set up to be worth running, which means it has to stay green. Rules that
// would fire hundreds of times across existing code are warnings, so `npm run
// lint` reports them without blocking a deploy on work nobody has scheduled.
// Anything that catches a real defect is an error.
//
// tsc already owns unused variables and type mistakes, so those are off here
// rather than reported twice in different words.

export default [
  {
    ignores: [
      "dist/**",
      "dev-dist/**",
      "node_modules/**",
      "supabase/**",
      "public/**",
      "**/*.config.js",
    ],
  },
  js.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: "latest", sourceType: "module", ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, ...globals.es2021 },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,

      // tsc reports these, with better messages.
      "no-unused-vars": "off",
      "no-undef": "off",
      "no-redeclare": "off",

      // Hooks called conditionally break React outright. The one rule here
      // that is always a defect.
      "react-hooks/rules-of-hooks": "error",

      // The React Compiler rule family, which version 7 of the plugin turns on
      // as errors. They are worth reading and mostly right, but they fire 50
      // times across code that works, and a gate that is red on the day it is
      // added gets switched off rather than fixed. Warnings: visible in
      // `npm run lint`, not blocking a deploy.
      "react-hooks/exhaustive-deps": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/static-components": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/preserve-manual-memoization": "warn",

      // Style, not a defect: a let initialised then overwritten on both paths.
      "no-useless-assignment": "warn",

      "react-refresh/only-export-components": "off",

      // == against null is idiomatic and intended; == elsewhere is a bug.
      eqeqeq: ["error", "smart"],
      "no-debugger": "error",
      "no-empty": ["warn", { allowEmptyCatch: true }],
      "no-constant-condition": ["error", { checkLoops: false }],
    },
  },
  {
    files: ["api/**/*.ts", "scripts/**/*.{ts,mjs,js}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: "latest", sourceType: "module" },
      globals: { ...globals.node, ...globals.es2021 },
    },
    plugins: { "@typescript-eslint": tsPlugin },
    rules: {
      "no-unused-vars": "off",
      "no-undef": "off",
      "no-empty": ["warn", { allowEmptyCatch: true }],
      "no-useless-assignment": "warn",
      eqeqeq: ["error", "smart"],
      "no-debugger": "error",
    },
  },
];
