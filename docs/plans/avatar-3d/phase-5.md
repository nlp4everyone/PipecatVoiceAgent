# Giai đoạn 5 — App mobile qua WebView

Mục tiêu: avatar chạy trong `apps/mobile` trên iPhone, qua Tailscale như kế hoạch
mobile, không nóng rõ rệt sau 10 phút gọi. Quả cầu Skia hiện có vẫn là dự phòng.

## Cách làm

WebRTC và mic/loa vẫn ở native như hiện nay. Một WebView tải trang avatar của web
chỉ để hiển thị. App native gửi sang WebView:

- Mức âm của bot và của người dùng. Đã có `use-orb-level.ts` đọc mỗi ~80 ms; cần
  nội suy trong WebView cho mượt.
- Trạng thái hội thoại (`idle / listening / thinking / speaking`).
- Sự kiện biểu cảm (từ phase 3).

```
Native (WebRTC) ──► mức âm, trạng thái, biểu cảm ──postMessage──► WebView (avatar)
```

Cách này dùng chung code với web. Phương án `expo-gl` + R3F native đã cân nhắc
nhưng không chọn vì `three-vrm` trên React Native hay lỗi texture và loader.

## Các bước

| # | Việc | Xong khi |
|---|---|---|
| 5.1 | Thêm trang avatar độc lập (không kết nối WebRTC), nhận dữ liệu qua `postMessage` | Chạy được trên trình duyệt di động |
| 5.2 | Màn hình WebView trong `apps/mobile` | Avatar hiện trong màn hình gọi |
| 5.3 | Bridge mức âm, trạng thái, biểu cảm; nội suy mức âm | Miệng khớp, không giật |
| 5.4 | Tắt render khi app xuống nền (`AppState`) | Không tốn pin khi nền |
| 5.5 | Tuỳ chọn avatar / quả cầu trong app | Chuyển được, quả cầu vẫn là dự phòng |
| 5.6 | Đo trên iPhone 15 Pro Max: fps, nhiệt, pin sau 10 phút | Đạt ngân sách |

### Điều chưa biết

- Tôi chưa kiểm chứng audio WebRTC native và WebView có xung đột trên iOS không.
  Thiết kế giữ WebRTC ở native để tránh, nhưng phải thử thật.
- Độ trễ của bridge (80 ms + `postMessage`) có đủ cho lip-sync mượt không.
- Cần build lại app native nếu thêm thư viện WebView (`react-native-webview`).

**Xong khi:** trên iPhone qua Tailscale, avatar nói chuyện khớp miệng, đạt ngân
sách hiệu năng, và quả cầu vẫn dùng được làm dự phòng.
