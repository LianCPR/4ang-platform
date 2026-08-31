import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Trong lúc chạy `npm run dev`, chuyển mọi request /api sang backend Express
    // (chạy riêng ở cổng 3001 — xem README ở server/). Nhờ vậy code gọi
    // fetch("/api/...") dùng được y nguyên ở cả dev và production.
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
