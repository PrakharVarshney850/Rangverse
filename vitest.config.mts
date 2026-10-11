import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    projects: [
      {
        test: {
          name: "unit",
          environment: "jsdom",
          globals: true,
          setupFiles: ["./tests/support/setup-dom.ts"],
          include: ["tests/unit/**/*.test.{ts,tsx}"],
        },
      },
      {
        test: {
          name: "rls",
          environment: "node",
          globals: true,
          include: ["tests/rls/**/*.test.ts"],
          // Each suite boots its own PostgreSQL instance (PGlite).
          testTimeout: 60_000,
          hookTimeout: 120_000,
          pool: "forks",
        },
      },
      {
        test: {
          name: "integration",
          environment: "node",
          globals: true,
          include: ["tests/integration/**/*.test.ts"],
          testTimeout: 60_000,
          hookTimeout: 120_000,
          pool: "forks",
        },
      },
    ],
  },
});
