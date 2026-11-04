# Giai đoạn 5 — App mobile qua WebView

Mục tiêu: avatar chạy trong `apps/mobile` trên iPhone, qua Tailscale như kế hoạch
mobile, không nóng rõ rệt sau 10 phút gọi. Quả cầu Skia hiện có vẫn là dự phòng.

## Cách làm

WebRTC và mic/loa vẫn ở native như hiện nay. Một WebView tải trang avatar của web
chỉ để hiển thị. App native gửi sang WebView:

- Mức âm của bot và của người dùng. Đã có `use-orb-level.ts` đọc mỗi ~80 ms; cần
  nội suy trong WebView cho mượt. Mobile chỉ có số vô hướng 0..1 (`audioLevel`),
  không có phổ tần như web, nên **lip-sync ở mobile theo biên độ** (đã chốt): trang
  nhúng không tạo `AudioContext`, chỉ điều khiển độ mở miệng (`aa`, có thể thêm `oh`
  nhẹ). Không chọn hình miệng theo dải tần như `use-avatar-lipsync.ts` của web.
- Trạng thái hội thoại (`idle / listening / thinking / speaking`).
- Sự kiện biểu cảm (từ phase 3). Backend gửi `server-message` với
  `data.type === "avatar-expression"`; transport mobile chuyển tin có nhãn `rtvi-ai`
  lên client, nên mobile chỉ cần `client.on(RTVIEvent.ServerMessage, ...)` như
  `voice-screen.tsx` của web (đọc từ code, chưa thử cuộc gọi thật).

```
Native (WebRTC) ──► mức âm, trạng thái, biểu cảm ──postMessage──► WebView (avatar)
```

Cách này dùng chung code với web. Phương án `expo-gl` + R3F native đã cân nhắc
nhưng không chọn vì `three-vrm` trên React Native hay lỗi texture và loader.

## Các bước

| # | Việc | Xong khi |
|---|---|---|
| 5.1 | Thêm trang avatar độc lập (không kết nối WebRTC), nhận dữ liệu qua `postMessage`. Thêm nguồn "mức âm từ ngoài" cho `useAvatarLipsync` (hiện chỉ nhận `MediaStreamTrack`) | Chạy được trên trình duyệt di động |
| 5.2 | Màn hình WebView trong `apps/mobile` | Avatar hiện trong màn hình gọi |
| 5.3 | Bridge mức âm, trạng thái, biểu cảm; nội suy mức âm; chỉnh lại `NOISE_FLOOR`/`FULL_LEVEL` theo thang mức âm; hook đọc `RemoteAudioLevel` luôn theo bot (`use-orb-level.ts` hiện chỉ theo một nguồn) | Miệng khớp, không giật |
| 5.4 | Tắt render khi app xuống nền (`AppState`) | Không tốn pin khi nền |
| 5.5 | Tuỳ chọn avatar / quả cầu trong app | Chuyển được, quả cầu vẫn là dự phòng |
| 5.6 | Đo trên iPhone 15 Pro Max: fps, nhiệt, pin sau 10 phút | Đạt ngân sách. Điều kiện trước: đã phục vụ bản build (4.6.3), không đo trên Vite dev server; nên làm 4.6.1 trước để số đo không bị nặng vì tải model |

### Trang avatar được phục vụ thế nào

Tailscale đã có HTTPS cho web (`https://<pc>.<tailnet>.ts.net`, cổng 443, trỏ tới Vite
`:5173`) và cho bot (cổng 8443, trỏ tới `:7860`), nên WebView tải thẳng URL web, iOS ATS
không chặn. Cần thêm biến `EXPO_PUBLIC_AVATAR_URL` vào `apps/mobile` (hiện chỉ có
`EXPO_PUBLIC_BOT_URL`) và trang nhúng `?avatar-embed` (bước 5.1). Cổng 443 hiện là Vite
dev server (nặng, có HMR); phải chuyển sang bản build trước khi đo. File `.vrm` nặng nên
việc giảm dung lượng ở bước 4.6 liên quan trực tiếp tới thời gian tải qua Tailscale.

### Điều chưa biết

- Tôi chưa kiểm chứng audio WebRTC native và WebView có xung đột trên iOS không.
  Thiết kế giữ WebRTC ở native để tránh, nhưng phải thử thật.
- Độ trễ của bridge (80 ms + `postMessage`) có đủ cho lip-sync mượt không.
- Cần build lại app native nếu thêm thư viện WebView (`react-native-webview`). Chưa
  kiểm tra tương thích với Expo 55 / RN 0.83 (kiến trúc mới); khi cài phải ghim phiên
  bản và kiểm tra trước.
- WebView có giữ cache file `.vrm` và `localStorage` (khoá `avatar-tier`) giữa các lần
  mở app không; số đo 60 fps ở phase 4.1 nhiều khả năng đo trong Safari, WKWebView có
  thể khác.
- Mobile dùng transport 1.8.0 (đã vá), web dùng 1.10.8: cần thử một cuộc gọi thật để
  chắc tin biểu cảm tới nơi. Độ trễ biểu cảm so với giọng chưa đo (xem phase 3).
- Phạm vi: kế hoạch chỉ nhắc iPhone, nhưng `apps/mobile/android` có sẵn và số đo mức
  âm trước đó lấy từ Android. Cần chốt có hỗ trợ Android không.

**Xong khi:** trên iPhone qua Tailscale, avatar nói chuyện khớp miệng, đạt ngân
sách hiệu năng, và quả cầu vẫn dùng được làm dự phòng.
