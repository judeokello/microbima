import { FlatCompat } from "@eslint/eslintrc";
import tseslint from "typescript-eslint";

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
});

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    ignores: [
      "node_modules/**", 
      ".next/**", 
      "out/**", 
      "build/**", 
      "next-env.d.ts",
      "*.config.js",
      "*.config.mjs",
      "*.config.ts",
      ".github/**",
      ".husky/**",
      "sentry.*.config.ts",
      "instrumentation.ts"
    ]
  },
  { 
    files: ["**/*.{js,mjs,cjs,ts,jsx,tsx}"] 
  },
  // Use compat for Next.js config which uses legacy format
  ...compat.extends("next/core-web-vitals"),
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Basic Next.js-specific overrides
      "@next/next/no-img-element": "off",
      
      // React rules - disable strict entity escaping
      "react/no-unescaped-entities": "off",
      
      // TypeScript rules (basic ones that don't require type info)
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          "argsIgnorePattern": "^_",
          "varsIgnorePattern": "^_",
          "caughtErrorsIgnorePattern": "^_"
        }
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      
      // TypeScript rules that require type info
      "@typescript-eslint/prefer-nullish-coalescing": "warn",
      "@typescript-eslint/no-unnecessary-type-assertion": "warn",
      
      // Basic style rules
      "no-trailing-spaces": "error",
      "no-multiple-empty-lines": ["error", { max: 1 }],
    },
  },
];