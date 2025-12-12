import { defineConfig } from "astro/config";

// https://astro.build/config
export default defineConfig({
  build: {
    format: 'file'
  },
  base: './',
  vite: {
    ssr: {
      external: ["music-metadata"],
    },
  },
  publicDir: "public",
});
