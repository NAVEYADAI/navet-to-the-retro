// Jest does not run its configured `transform` over globalSetup/globalTeardown
// modules, so this stays plain CommonJS and registers ts-node itself before
// pulling in the (TypeScript) safety guard — avoids duplicating that logic.
// Forced to plain commonjs/node resolution here (overriding the project's
// "nodenext" tsconfig) because ts-node's type-checked nodenext compile of
// this file mis-resolves __dirname's type when loaded via plain `require`.
process.env.TS_NODE_TRANSPILE_ONLY = 'true';
process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({
  module: 'commonjs',
  moduleResolution: 'node',
  resolvePackageJsonExports: false,
});
require('ts-node/register');
const { assertTestDatabase } = require('./require-test-db');

module.exports = async function globalSetup() {
  assertTestDatabase();
};
