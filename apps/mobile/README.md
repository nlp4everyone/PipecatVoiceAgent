# Voice Agent — mobile

App Expo (SDK 55) cho iPhone và Android, nói chuyện với bot qua SmallWebRTC.
Kế hoạch và lý do chọn phiên bản: [docs/plans/mobile-app/phase-1.md](../../docs/plans/mobile-app/phase-1.md).

Dùng `expo-dev-client`, **không** chạy được bằng Expo Go (WebRTC là native module).

## Chạy

```bash
cp .env.example .env        # điền EXPO_PUBLIC_BOT_URL
npm install

# Cài dev client lên máy (lần đầu, và mỗi khi đổi thư viện native / app.json)
npm run android             # PC Ubuntu, Android cắm USB
npm run ios                 # Mac, iPhone cắm USB

# Hằng ngày: Metro trên PC, app tự tải JS
npm start
REACT_NATIVE_PACKAGER_HOSTNAME=$(tailscale ip -4) npm start   # qua Tailscale
```

Bot phải mở HTTPS cho app:

```bash
make run-local                                        # ở thư mục gốc repo
tailscale serve --bg --https=8443 http://127.0.0.1:7860
```

Sửa `.env` xong phải khởi động lại Metro (`npm start -- --clear` nếu giá trị cũ còn bám).

## Kiểm tra

```bash
npm run typecheck
npm run doctor
```

## Cấu trúc

```
index.ts                     # đăng ký App
src/App.tsx                  # màn hình duy nhất: ghép hook + component
src/lib/config.ts            # đọc EXPO_PUBLIC_*
src/lib/transports.ts        # registry transport (copy từ web), đăng ký RNSmallWebRTCTransport
src/hooks/use-pipecat-app.ts # vòng đời client (copy từ web)
src/hooks/use-conversation.ts# trạng thái, chữ hội thoại, mute
src/components/              # status-indicator, transcript, controls
```
