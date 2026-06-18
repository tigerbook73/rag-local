/** @type {import('@commitlint/types').UserConfig} */
export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "scope-empty": [2, "never"],
    "subject-case": [0],
  },
};
