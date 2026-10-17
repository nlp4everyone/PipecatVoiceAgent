# VoiceAgent — web app

Giao diện giọng nói kiểu ChatGPT Voice cho bot, dựng bằng
[Pipecat UI](https://docs.pipecat.ai/client/pipecat-ui) (shadcn registry `@pipecat`),
React 19, Vite và Tailwind 4. Kết nối qua SmallWebRTC.

## Chạy

Cần Node.js 22+.

```bash
# 1. bot (dev runner, cổng 7860) — ở thư mục gốc
make dev            # hoặc: make run-local

# 2. web app (cổng 5173)
make web-install    # lần đầu
make web-dev
```

Mở <http://localhost:5173>, bấm **Bắt đầu trò chuyện** và cho phép micro.

Bot chạy ở chỗ khác thì đặt `BOT_URL`, ví dụ `cd apps/web && BOT_URL=http://192.168.1.10:7860 npm run dev`.

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
