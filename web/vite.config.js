import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Actions sets VITE_BASE_PATH=./ for Pages; local dev defaults to /TCLOT/
export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/TCLOT/',
  plugins: [react()],
  server: {
    // App lives under base `/TCLOT/` — open `http://localhost:5173/TCLOT/` (root URL alone is empty).
    open: '/TCLOT/',
    // Live tab: same-origin `/__fpl/*` when `npm run dev` and VITE_FPL_PROXY_URL is unset
    // (avoids CORS + works without redeploying the Cloudflare worker).
    proxy: {
      '^/__fpl/draft/': {
        target: 'https://draft.premierleague.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/__fpl\/draft/, '/api'),
      },
      '^/__fpl/': {
        target: 'https://fantasy.premierleague.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/__fpl/, '/api'),
      },
    },
  },
})
