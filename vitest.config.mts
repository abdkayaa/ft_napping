import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    fileParallelism: false,
    env: {
      DATABASE_URL: "memory://",
      VOTER_SALT: "test-salt-0123456789-0123456789-abcdef",
      SESSION_SECRET: "test-secret-0123456789-0123456789-abcdef",
      ADMIN_PASSWORD: "correct-horse-battery",
    },
  },
});
