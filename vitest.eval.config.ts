import { defineConfig } from "vitest/config";
import path from "node:path";

// Live model evals; kept out of the regular test run because they need an API key and network.
export default defineConfig({
  test: {
    environment: "node",
    include: ["evals/**/*.eval.ts"],
    testTimeout: 30000,
    fileParallelism: false,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
