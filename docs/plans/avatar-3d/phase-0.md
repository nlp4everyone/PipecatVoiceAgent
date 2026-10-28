# Giai đoạn 0 — Chọn model và dựng trang thử

Mục tiêu: có một avatar VRM hiển thị được trên web, chạy ≥30 fps, và biết rõ
hiện trạng `apps/web` trước khi tích hợp. Chưa nối với bot.

## Các bước

| # | Việc | Xong khi |
|---|---|---|
| 0.1 | Tạo branch `feat/avatar-3d` từ `feat/chatgpt-voice-client` | `git branch` thấy branch, có `apps/web` |
| 0.2 | Đọc `voice-screen.tsx`, `App.tsx`, `use-pipecat-app.ts` để xác định điểm chọn quả cầu / avatar | Ghi được vào tài liệu: sửa ở đâu, ít nhất là bao nhiêu file |
| 0.3 | Tải 3–5 model VRM, xem trong viewer online, chọn một | Có model, ghi giấy phép và nguồn |
| 0.4 | Dựng trang thử R3F chỉ hiển thị avatar: idle, chớp mắt, nhìn theo con trỏ | Avatar hiện, chuyển động tự nhiên |
| 0.5 | Kiểm tra font tiếng Việt với các từ nhiều dấu | Biết font hiện tại có đủ dấu không |
| 0.6 | Đo fps và nhiệt trên thiết bị thật | Có số liệu đầu tiên làm mốc |

### 0.3 Nguồn và cách chọn model

Nguồn: Open Source Avatars (GitHub `toxsam/open-source-avatars`), OpenGameArt
"VRoid Studio CC0 models" (AvatarSample D, E, F, G), VRoid Hub, Booth.

Lọc theo:

- Định dạng `.vrm`.
- Giấy phép cho dùng cá nhân và nên cho chỉnh sửa.
- Dưới khoảng 70k tam giác, texture không quá lớn.
- Có đủ expression miệng và mắt. Kiểm tra bằng viewer trước (Tripo VRM Viewer,
  zff.dev three-vrm, hoặc UniVRMTest trên máy tính).
- Thử cả VRM 0.x và 1.0 nếu có.

Model mẫu của VRoid là anime tỉ lệ thường, không phải chibi. Chibi thật phải
chỉnh trong VRoid Studio hoặc tìm model khác.

### 0.4 Gợi ý thư viện

`three`, `@react-three/fiber`, `@react-three/drei`, `@pixiv/three-vrm`,
`@pixiv/three-vrm-animation`. Ghim phiên bản chính xác, dùng `npm ci` từ
lockfile, và kiểm tra thông tin an ninh của package trước khi cài.

### 0.6 Cách đo

- Web: DevTools Performance, thêm bộ đếm fps.
- iPhone: Safari Web Inspector qua cáp, hoặc quay màn hình và theo dõi nhiệt
  độ máy bằng cảm nhận trong 10 phút. Tôi chưa chọn công cụ đo chính thức.
- Thử thêm trên một máy yếu nếu có.

**Xong khi:** avatar chạy ổn trên web, có số liệu fps trên ít nhất một máy, đã
chọn model, đã biết điểm chọn trong `voice-screen`.
