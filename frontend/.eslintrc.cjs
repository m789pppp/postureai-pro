module.exports = {
  root: true,
  env: { browser: true, es2020: true, node: true },
  extends: [
    "eslint:recommended",
    "plugin:react/recommended",
    "plugin:react/jsx-runtime",
    "plugin:react-hooks/recommended",
  ],
  ignorePatterns: ["dist", ".eslintrc.cjs", "vite.config*.js"],
  parserOptions: { ecmaVersion: "latest", sourceType: "module" },
  settings: { react: { version: "18.2" } },
  globals: {
    React: "readonly",
    __APP_VERSION__: "readonly"
  },
  rules: {
    "no-unused-vars": "off",
    "no-console": "off",
    "react/prop-types": "off",
    "react/display-name": "off",
    "react/no-unescaped-entities": "off",
    "react/jsx-key": "warn",
    "react/jsx-no-undef": "off",
    "no-undef": "off",
    "no-constant-condition": "off",
    "no-empty": "off",
    "no-fallthrough": "off",
    "no-prototype-builtins": "off",
    "no-redeclare": "warn",
  },
};
