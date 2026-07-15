import type { Config } from "jest";
import nextJest from "next/jest.js";

const createJestConfig = nextJest({
  // Loads next.config.ts and .env files into the test environment.
  dir: "./",
});

const config: Config = {
  coverageProvider: "v8",
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/tests/jest.setup.ts"],

  // Every unit test lives under web/tests; mirror the src/ layout there so
  // a file's location tells you what it covers.
  roots: ["<rootDir>/tests"],
  testMatch: ["<rootDir>/tests/**/*.test.{ts,tsx}"],

  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },

  collectCoverage: true,
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/**/*.d.ts",
    // Root layout is mostly next/font + metadata wiring with no branching
    // logic of our own; not worth unit-testing over an E2E/visual check.
    "!src/app/layout.tsx",
  ],
  coverageThreshold: {
    global: {
      branches: 75,
      functions: 75,
      lines: 75,
      statements: 75,
    },
  },
};

export default createJestConfig(config);
