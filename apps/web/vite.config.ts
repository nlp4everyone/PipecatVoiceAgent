import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Bot (Pipecat dev runner) chạy ở cổng 7860. Proxy để client gọi /start và
// /sessions/* cùng origin, khỏi phải lo CORS và URL tuyệt đối.
const BOT_URL = process.env.BOT_URL ?? 'http://localhost:7860'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    port: 5173,
    // Cho phép truy cập qua Cloudflare Tunnel (subdomain đổi mỗi lần chạy) và Tailscale (*.ts.net).
    allowedHosts: ['.trycloudflare.com', '.ts.net'],
    proxy: {
      '/start': BOT_URL,
      '/sessions': BOT_URL,
      '/api/offer': BOT_URL,
    },
  },
})
