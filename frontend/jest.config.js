const fs = require('fs');
const path = require('path');

// Where npm puts a package depends on the install: this is an npm workspace, so the same dependency can land in
// frontend/node_modules on one machine and in the root node_modules on another (a fresh clone, CI). The mappings
// below used to hard-code one of the two and every suite failed on the other, so the folder is looked up instead.
function packageDir(name) {
  for (const dir of require.resolve.paths(name) ?? []) {
    const candidate = path.join(dir, name);
    if (fs.existsSync(path.join(candidate, 'package.json'))) return candidate;
  }
  throw new Error(`jest.config.js: "${name}" is not installed (run npm install --legacy-peer-deps from the repository root)`);
}

// One copy of React for the whole test run: two copies break hooks.
const react = packageDir('react');

module.exports = {
  preset: 'jest-expo',
  testTimeout: 20000,
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/e2e/'],
  moduleDirectories: ['node_modules', '<rootDir>/node_modules', '<rootDir>/../node_modules'],
  moduleNameMapper: {
    '\\.(css|sass|scss)$': '<rootDir>/jest/css-mock.js',
    '^framer-motion$': '<rootDir>/jest/framer-motion-mock.js',
    '^react$': react,
    '^react/(.*)$': `${react}/$1`,
    '^@react-native-async-storage/async-storage$': '@react-native-async-storage/async-storage/jest/async-storage-mock',
    '^lucide-react-native$': path.join(packageDir('lucide-react-native'), 'dist/cjs/lucide-react-native.js'),
  },
};
