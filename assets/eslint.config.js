import js from "@eslint/js"
import importPlugin from "eslint-plugin-import"
import jsxA11y from "eslint-plugin-jsx-a11y"
import reactHooks from "eslint-plugin-react-hooks"
import tseslint from "typescript-eslint"

export default tseslint.config(
  { ignores: ["js/shared/generated/**", "node_modules/**", "../priv/**"] },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    files: ["js/**/*.{ts,tsx}", "test/**/*.tsx", "browser/**/*.ts", "playwright.config.ts"],
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
    settings: { "import/resolver": { typescript: true } },
    plugins: { import: importPlugin, "jsx-a11y": jsxA11y, "react-hooks": reactHooks },
    rules: {
      ...jsxA11y.flatConfigs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      "import/no-cycle": "error",
    },
  },
  {
    files: ["js/profiles.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["./profiles/ProfilesApp"], message: "Import the profiles feature through its public index.ts." },
          ],
        },
      ],
    },
  },
  {
    files: ["js/profiles/{api,model,ui}/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["../ProfilesApp", "../index", "../../profiles", "../../profiles.tsx", "../../profiles/index"],
              message: "Feature internals must not depend on an entry point or public composition layer.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["test/**/*.tsx"],
    rules: {
      // node:test registers asynchronous tests without awaiting its returned handles.
      "@typescript-eslint/no-floating-promises": "off",
      "@typescript-eslint/require-await": "off",
    },
  },
)
