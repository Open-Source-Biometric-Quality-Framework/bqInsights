import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const markdownItDir = fs.existsSync(path.resolve(__dirname, "node_modules/markdown-it"))
  ? path.resolve(__dirname, "node_modules/markdown-it")
  : path.resolve(__dirname, "../node_modules/markdown-it");

export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "markdown-it": markdownItDir,
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
