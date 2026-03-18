import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ isSsrBuild }) => ({
  base: isSsrBuild ? undefined : './',
  plugins: [react()],
  build: {
    outDir: isSsrBuild ? 'dist-ssr' : 'dist',
    // emit an SSR manifest on client builds so the server can reference hashed assets
    ssrManifest: !isSsrBuild,
  },
}))
