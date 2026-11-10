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

// Đặt Cache-Control cho file .vrm khi chạy `vite preview` (bước 4.6.4). Chỉ có tác dụng với preview; production
// (Caddy/nginx) phải đặt lại. `immutable` chỉ cho file có hash nội dung trong tên (`*.<8 hex>.vrm`, tạo bằng
// tools/hash-avatar.mjs); tên chưa hash dùng max-age ngắn để đổi model không bị giữ bản cũ.
const HASHED_VRM = /\.[0-9a-f]{8}\.vrm$/
function vrmCacheControl(): Plugin {
  return {
    name: 'vrm-cache-control',
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathname = req.url?.split('?')[0] ?? ''
        if (pathname.endsWith('.vrm')) {
          const value = HASHED_VRM.test(pathname)
            ? 'public, max-age=31536000, immutable'
            : 'public, max-age=3600'
          const setHeader = res.setHeader.bind(res)
          // sirv đặt Cache-Control sau middleware này nên phải chặn ở setHeader.
          res.setHeader = (name, v) => setHeader(name, name.toLowerCase() === 'cache-control' ? value : v)
          setHeader('Cache-Control', value)
        }
        next()
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), preloadAvatarModel(), vrmCacheControl()],
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
