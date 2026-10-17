# VoiceAgent — web app

Giao diện giọng nói kiểu ChatGPT Voice cho bot, dựng bằng
[Pipecat UI](https://docs.pipecat.ai/client/pipecat-ui) (shadcn registry `@pipecat`),
React 19, Vite và Tailwind 4. Kết nối qua SmallWebRTC.

## Chạy

Cần:

- [Node.js](https://nodejs.org/) 22.12+ (đi kèm `npm`), ví dụ qua
  [nvm](https://github.com/nvm-sh/nvm): `nvm install 22`. Nếu `node -v` báo
  `command not found` thì nvm chưa được nạp vào shell, xem
  [hướng dẫn cài nvm](https://github.com/nvm-sh/nvm#installing-and-updating).
- Trình duyệt hỗ trợ WebRTC và WebGL (Chrome, Edge, Firefox, Safari bản mới).
- Bot đang chạy ở cổng 7860 (`make run-local` hoặc `make dev`), xem
  [README gốc](../../README.md#chạy-thử-nhanh).

Ở thư mục gốc:

```bash
make web-install    # lần đầu
make web-dev        # http://localhost:5173
```

Mở <http://localhost:5173>, bấm **Bắt đầu trò chuyện** và cho phép micro.

Bot chạy ở máy khác thì đặt `BOT_URL`, ví dụ
`cd apps/web && BOT_URL=http://192.168.1.10:7860 npm run dev`.

## Public qua Cloudflare Tunnel

Mở web app từ thiết bị khác qua
[Quick Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/do-more-with-tunnels/trycloudflare/)
(không cần tài khoản; cài `cloudflared` theo
[hướng dẫn](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/)):

```bash
cloudflared tunnel --url http://localhost:5173
```

Mở URL `https://….trycloudflare.com` mà lệnh in ra. Âm thanh WebRTC không đi qua
tunnel, nên mạng chặt (4G, mạng công ty) có thể cần thêm TURN server.

## Luồng kết nối

Vite proxy `/start`, `/sessions/*` và `/api/offer` sang bot, nên client và bot
coi như cùng origin:

1. `POST /start` → runner tạo session, trả `sessionId` + `iceConfig`.
2. Transport gửi WebRTC offer tới `/sessions/{sessionId}/api/offer`.
3. Bot khởi động, gửi `bot-ready` qua RTVI → client chuyển sang trạng thái `ready`.

Khi build production (`npm run build`), cần một reverse proxy làm việc tương tự.

## Cấu trúc

| File | Vai trò |
|---|---|
| `src/App.tsx` | Tạo `PipecatClient` (SmallWebRTC) và bọc `PipecatClientProvider` |
| `src/components/voice-screen.tsx` | Màn hình chính: quả cầu, trạng thái, phụ đề, nút điều khiển, panel hội thoại |
| `src/components/pipecat/` | Component Pipecat UI, cài bằng `shadcn add`, sửa trực tiếp được |
| `src/hooks/use-pipecat-app.ts` | Vòng đời client: start bot, connect, disconnect |

Quả cầu (`AudioVisualizerWaveView`) đổi trạng thái theo event RTVI:

| Event | Pha | Quả cầu |
|---|---|---|
| `UserStartedSpeaking` | đang nghe người dùng | nhảy theo mic |
| `UserStoppedSpeaking` | đang suy nghĩ | hiệu ứng thinking |
| `BotStartedSpeaking` | bot đang nói | nhảy theo giọng bot |
| `BotStoppedSpeaking` | chờ | thở nhẹ |

Thêm component khác: `npx shadcn@latest add @pipecat/<tên>` (`npx shadcn@latest search @pipecat` để xem danh sách).
