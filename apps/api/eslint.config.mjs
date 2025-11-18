import tseslint from "typescript-eslint";

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    ignores: ["node_modules/**", "dist/**", "coverage/**", "*.config.ts", "*.config.js"]
  },
  { 
    files: ["**/*.{js,mjs,cjs,ts,jsx,tsx}"] 
  },
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // TypeScript rules
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          "argsIgnorePattern": "^_",
          "varsIgnorePattern": "^_",
          "caughtErrorsIgnorePattern": "^_"
        }
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/prefer-nullish-coalescing": "warn",
      "@typescript-eslint/no-unnecessary-type-assertion": "warn",
      
      // NestJS specific rules
      "@typescript-eslint/interface-name-prefix": "off",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      
      // Basic style rules
      "no-trailing-spaces": "error",
      "no-multiple-empty-lines": ["error", { max: 1 }],
      "semi": ["error", "always"],
      "quotes": ["error", "single"],
    },
  },
];
