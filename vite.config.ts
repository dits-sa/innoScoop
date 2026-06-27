import { defineConfig } from 'vite'
import webExtension from 'vite-plugin-web-extension'

// Polyfill injected before pusher-js initializes in the service worker.
// Service workers have no `window` or `document` — these stubs cover exactly
// the pusher-js code paths we exercise (WebSocket transport, no JSONP/DOM).
const SW_POLYFILL = `
if (typeof window === "undefined") { globalThis.window = globalThis; }
if (typeof document === "undefined") {
  globalThis.document = {
    body: true,
    location: { protocol: "https:" },
    createElement: () => ({
      type: "", charset: "", async: false, src: "", id: "",
      onload: null, onerror: null, onreadystatechange: null, parentNode: null,
    }),
    getElementsByTagName: () => [{ insertBefore: () => {} }],
  };
}
`.trim()

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
        intro: SW_POLYFILL,
      },
    },
  },
})
