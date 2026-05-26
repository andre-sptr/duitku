/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/*.test.ts"],
  // Compile tests as CommonJS regardless of the Expo base tsconfig's ESM settings.
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      { tsconfig: { module: "commonjs", verbatimModuleSyntax: false, isolatedModules: false } },
    ],
  },
};
