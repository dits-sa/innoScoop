import { defineConfig } from 'vite'
import webExtension from 'vite-plugin-web-extension'

export default defineConfig({
  plugins: [
    webExtension({
      manifest: './manifest.json',
      webExtConfig: {
        browser: 'chrome',
      },
    }),
  ],
  build: {
    minify: false,
    rollupOptions: {
      output: {
        format: 'iife',
        inlineDynamicImports: true,
      },
    },
  },
})
