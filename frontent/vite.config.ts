import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import viteCompression from "vite-plugin-compression";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),

    // Brotli compression (best ratio, modern browsers)
    viteCompression({
      algorithm: "brotliCompress",
      ext: ".br",
      threshold: 1024,
      deleteOriginFile: false,
      compressionOptions: {
        level: 11,
      },
    }),

    // Gzip compression (fallback)
    viteCompression({
      algorithm: "gzip",
      ext: ".gz",
      threshold: 1024,
      deleteOriginFile: false,
      compressionOptions: {
        level: 9,
      },
    }),
  ],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  build: {
    outDir: "../server/dist", // Output to backend dist folder
    emptyOutDir: true,
    sourcemap: false,
    chunkSizeWarningLimit: 1000,
    target: "es2015",
    minify: "esbuild",
    cssCodeSplit: true,
    cssMinify: true,

    // Improve build performance
    reportCompressedSize: false, // Skip gzip size reporting (faster builds)

    commonjsOptions: {
      include: ["node_modules/**"],
      transformMixedEsModules: true,
    },
  },

  css: {
    devSourcemap: false,
  },

  // Esbuild options for better tree-shaking
  esbuild: {
    // drop: ['console', 'debugger'],
    legalComments: "none",
    treeShaking: true,
    minifyIdentifiers: true,
    minifySyntax: true,
    minifyWhitespace: true,
  },

  // Performance optimizations
  server: {
    hmr: {
      overlay: true,
    },
  },

  // Improve production build performance
  worker: {
    format: "es",
  },
});
