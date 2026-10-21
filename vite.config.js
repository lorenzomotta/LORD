import { defineConfig } from "vite";

// Vite prepara i file della finestra. Tauri li apre dentro l'app Windows.
export default defineConfig({
  root: "src",
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: "127.0.0.1",
  },
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    target: "es2021",
  },
});
