import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages deploys to https://<user>.github.io/<repo>/
// Set base to repo name for GitHub Pages, or '/' for custom domain
export default defineConfig({
  plugins: [react()],
  base: '/dmoose-search-classifier/',
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
