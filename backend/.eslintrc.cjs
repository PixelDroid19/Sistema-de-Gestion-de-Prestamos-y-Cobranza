module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true,
  },
  extends: ["eslint:recommended"],
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "script",
  },
  rules: {
    "no-unused-vars": [
      "warn",
      {
        args: "none",
        varsIgnorePattern: "^_",
      },
    ],
    "no-useless-escape": "warn",
  },
  ignorePatterns: [
    "coverage/",
    "logs/",
    "node_modules/",
    "uploads/",
    "development.sqlite",
    "*.sqlite",
    "*.sqlite-journal",
    "*.sqlite-shm",
    "*.sqlite-wal",
  ],
  overrides: [
    {
      files: ["tests/**/*.js"],
      env: {
        node: true,
      },
    },
  ],
};