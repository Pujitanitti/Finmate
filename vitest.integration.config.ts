import { defineConfig } from "vitest/config";
import path from "path";

/**
 * Separate config for integration tests (tests/integration/**), which
 * require a real PostgreSQL connection — see tests/integration/README.md.
 * Kept deliberately separate from vitest.config.ts so `npm test` (fast,
 * no database required) and `npm run test:integration` (real database
 * required) never accidentally run each other's tests.
 */
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/integration/**/*.integration.test.ts"],
    testTimeout: 15_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
