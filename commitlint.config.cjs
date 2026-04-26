/** @type {import('@commitlint/types').UserConfig} */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'refactor', 'ui', 'perf', 'chore', 'docs', 'ci'],
    ],
    'subject-max-length': [2, 'always', 72],
  },
};
