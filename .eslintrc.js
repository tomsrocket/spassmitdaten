module.exports = {
  env: {
    commonjs: true,
    es6: true,
    node: true,
  },
  extends: [
    'airbnb'
  ],
  globals: {
    Atomics: 'readonly',
    SharedArrayBuffer: 'readonly',
  },
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
    ecmaVersion: 2018,
  },
  plugins: [
  ],
  rules: {
    "no-unused-expressions": "error",
    "no-implicit-globals": "error",
    "no-console": "off",
    "no-use-before-define": "off",
    "max-len": ["error", { "code": 120 }],
    "indent": ["error", 4],
  },
};
