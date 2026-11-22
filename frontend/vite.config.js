import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, root, "");
  return {
    define: {
      __BOOKING_AFFILIATE_ID__: JSON.stringify(env.BOOKING_AFFILIATE_ID || ""),
    },
    plugins: [react(), tailwindcss()],
    server: {
      proxy: {
        "/api": {
          target: process.env.API_PROXY || "http://127.0.0.1:8000",
          rewrite: (path) => path.replace(/^\/api/, ""),
        },
        "/go": {
          target: process.env.API_PROXY || "http://127.0.0.1:8000",
        },
      },
    },
    test: {
      environment: "jsdom",
      setupFiles: "./src/setupTests.js",
    },
  };
});
