import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      reportsDirectory: "./coverage",
      /** Foco em código testável (exclui pages e a maior parte de components do denominador). */
      include: [
        "src/lib/**/*.{ts,tsx}",
        "src/services/**/*.{ts,tsx}",
        "src/hooks/**/*.{ts,tsx}",
        "src/types/**/*.{ts,tsx}",
      ],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/**/*.spec.{ts,tsx}",
        "src/test/**",
        "**/*.d.ts",
      ],
      /** Baseline a partir de `npm run test:coverage` (pastas lib/services/hooks/types). Subir gradualmente. */
      thresholds: {
        lines: 20,
        statements: 20,
        branches: 75,
        functions: 18,
      },
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
