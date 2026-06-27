import { defineConfig } from 'vite'
import webExtension from 'vite-plugin-web-extension'

export default defineConfig({
  plugins: [
    webExtension({
      manifest: './manifest.json',
    }),
  ],
  build: {
    minify: false,
    rollupOptions: {
      output: {
        format: 'iife',
        inlineDynamicImports: true,
        // Service workers have no `window` — polyfill it before pusher-js initializes
        intro: 'if (typeof window === "undefined") { globalThis.window = globalThis; }',
      },
    },
  },
})
