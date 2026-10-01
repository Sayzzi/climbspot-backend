/** @type {import('@commitlint/types').UserConfig} */
export default {
  extends: ['@commitlint/config-conventional'],
  // The repository's first commit predates the convention.
  ignores: [(message) => message.trim() === 'Initial commit'],
};
