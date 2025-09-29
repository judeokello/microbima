import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
});

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    ignores: ["node_modules/**", ".next/**", "out/**", "build/**", "next-env.d.ts"]
  },
  { 
    files: ["**/*.{js,mjs,cjs,ts,jsx,tsx}"] 
  },
  {
    ignores: [".github/", ".husky/", ".next/", "src/components/ui", "*.config.ts", "*.mjs"]
  },
  ...compat.extends("next/core-web-vitals"),
  {
    rules: {
      // Basic Next.js-specific overrides
      "@next/next/no-img-element": "off",
      
      // React rules - disable strict entity escaping
      "react/no-unescaped-entities": "off",
      
      // Basic style rules only (no TypeScript rules for now)
      "no-trailing-spaces": "error",
      "no-multiple-empty-lines": ["error", { max: 1 }],
    },
  },
];