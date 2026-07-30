import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

/**
 * 配置 Vite 开发服务器、构建和测试环境。
 * @returns Vite 配置对象
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"]
  }
});
