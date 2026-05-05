import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  server: {
    port: 3000,
    proxy: {
      "/api": {
        target: process.env.PYTHON_API_URL ?? "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
  plugins: [tsConfigPaths(), tanstackStart(), viteReact(), tailwindcss()],
});
