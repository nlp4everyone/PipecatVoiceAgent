import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

// Bot (Pipecat dev runner) chạy ở cổng 7860. Proxy để client gọi /start và
// /sessions/* cùng origin, khỏi phải lo CORS và URL tuyệt đối.
const BOT_URL = process.env.BOT_URL ?? 'http://localhost:7860'

// Tải model avatar ngay khi đọc HTML, song song với JS (bước 4.6.2), một lần duy nhất. URL lấy từ VITE_AVATAR_URL để
// luôn khớp với AVATAR_URL trong src/components/avatar/vrm-frame.ts; giá trị mặc định phải giống ở đó.
const DEFAULT_AVATAR_URL = '/avatars/Mocking_Spit_Strawberry.vrm'
function preloadAvatarModel(): Plugin {
  let url = DEFAULT_AVATAR_URL
  return {
    name: 'preload-avatar-model',
    configResolved(config) {
      url = (config.env.VITE_AVATAR_URL as string | undefined) || DEFAULT_AVATAR_URL
    },
    transformIndexHtml() {
      // Tự fetch một lần và để `AvatarLoader` dùng lại (src/components/avatar/preload.ts). Không dùng
      // <link rel="preload">: Safari không gộp nó với fetch của GLTFLoader nên model tải hai lần.
      const u = JSON.stringify(url)
      return [
        {
          tag: 'script',
          children: `window.__avatarModel={url:${u},data:fetch(${u}).then(function(r){if(!r.ok)throw new Error(r.status);return r.arrayBuffer()})};window.__avatarModel.data.catch(function(){});`,
          injectTo: 'head-prepend',
        },
      ]
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), preloadAvatarModel()],
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
