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

## Kết quả

### 0.1 Branch

`feat/avatar-3d` đã có, chứa `apps/web` và `apps/mobile`.

### 0.2 Điểm chọn quả cầu / avatar trong `apps/web`

- `App.tsx` chỉ dựng client Pipecat và truyền `onConnect`, `onDisconnect`,
  `error` vào `VoiceScreen`. Không cần sửa.
- `use-pipecat-app.ts` chỉ quản lý vòng đời client. Không cần sửa.
- `components/voice-screen.tsx` là nơi duy nhất cần sửa. Quả cầu được render ở
  một chỗ (dòng ~157): `<ChatOrb track={orbTrack} state={orbState} muted=... size={240} />`,
  bọc trong một `<button>` chạm để bắt đầu gọi.
- `voice-screen` đã tính sẵn `orbState` (kiểu `OrbState`: `idle | connecting |
  listening | thinking | speaking`), `orbTrack` (track bot khi bot nói, track
  mic khi người dùng nói, `null` còn lại) và `muted`. Avatar dùng lại đúng
  ba giá trị này, nên phase 1 không cần suy luận lại trạng thái.
- `ChatOrb` tự tạo `AnalyserNode` từ `track` qua `lib/visualizer.ts`
  (`createVisualizerAnalyser`). Phase 2 dùng lại hàm này.
- Số file tối thiểu phase 1: sửa 1 (`voice-screen.tsx`), thêm
  `components/avatar/avatar-stage.tsx` và `use-avatar-state.ts`, cộng chỗ lưu
  cài đặt chuyển quả cầu / avatar.
- Chưa có chỗ cài đặt nào trong UI (header chỉ có nút phụ đề và hội thoại);
  tuỳ chọn avatar / quả cầu cần thêm một nút ở đó.
- Chưa có `three`, R3F hay `@pixiv/three-vrm` trong `package.json`.
- Font: Geist Variable (`@fontsource-variable/geist`), xem 0.5.
- Môi trường: Node 22.23.3, npm 10.9.9; Vite dev ở cổng 5173, proxy `/start`
  và `/sessions` sang bot ở 7860.

### 0.3 Model đã chọn

**Mocking Spit: Strawberry** (bộ Halloween Rising, Polygonal Mind / VIPE).

- Nguồn: registry `toxsam/open-source-avatars`, bộ `halloween-rising`, mục đầu
  tiên. URL file:
  `https://dweb.link/ipfs/QmXyEuwbgUfMG7WzRZys6JnS6DJvxqkPGDseZmHM8wLJm1/Avatar01_v1_Cute_Pink.vrm`
  (cổng `dweb.link` hay trả 429; `https://gateway.pinata.cloud/ipfs/<cid>/...`
  tải được).
- Giấy phép ghi trong file: `Other`, trỏ tới tài liệu của Halloween Rising
  (`ipfs://QmYGUNRqJdkoHyYQtUJXPRqtx1p8javsdv3fADR6mh54en`): cho chỉnh sửa, cho
  dùng thương mại, **bắt buộc ghi công và giữ nguyên giấy phép**, chỉ dành cho
  `ExplicitlyLicensedPerson`. Registry lại ghi CC0, hai nguồn chưa nhất quán.
- **Không commit file `.vrm`.** Đặt tại `apps/web/public/avatars/`, đã thêm vào
  `apps/web/.gitignore`. Người clone repo phải tải lại theo URL trên.
- Thông số (đọc từ file): VRM 0.x, 9.0k tam giác, 52 xương, đủ 30 xương ngón
  tay, 2 nhóm spring bones. Expression: `a e i o u`, `blink`, `blink_l`, `joy`,
  `sorrow`, `angry`, `fun`, `lookup/down/left/right`.
- Hạn chế: không có xương mắt và `jaw` (look-at phải xoay đầu hoặc dùng
  `look*`); không có `surprised` (VRM 0.x); `blink_r` không thấy trong danh sách
  có morph; là nhân vật quái vật dễ thương, không phải chibi người.
- Đã loại: chibi01–03 (Xmas Chibis, `Redistribution_Prohibited`, không có xương
  ngón tay), Rose (CC0 nhưng không có biểu cảm), CuteMoth (CC0 nhưng thiếu
  `look*`, 12 ngón).

### 0.5 Font tiếng Việt

Font giao diện hiện tại là **Geist Variable** (`@fontsource-variable/geist`, nhập ở
`index.css`). Đã kiểm tra:

- Gói font có sẵn bản con `vietnamese` (`geist-vietnamese-wght-normal.woff2`).
- Đọc bảng ký tự (cmap) của ba bản con latin, latin-ext, vietnamese: đủ cả 146
  chữ tiếng Việt (12 nguyên âm có dấu với đủ 5 dấu thanh, hoa và thường, cùng
  `đ/Đ`). Không thiếu ký tự nào.
- Dấu chồng (ệ, ữ, ể, ỡ, ằ…) hiển thị đúng ở độ đậm 300 và 700 trong Chrome;
  trình duyệt nạp đúng các bản con latin, latin-ext, vietnamese, không rơi về
  font hệ thống cho chữ Việt.
- Ngoại lệ nhỏ: `₫` (ký hiệu đồng) **không có** trong font, trình duyệt dùng font
  hệ thống thay thế nên nét hơi khác. Dùng chữ `đ` thay cho `₫`, hoặc chấp nhận.
- Chưa kiểm tra: iOS Safari và WebView (phase 5), nơi có thể có khác biệt dấu.

Kết luận: không phải đổi font. Avatar không có chữ trong canvas nên không bị
ảnh hưởng; phụ đề và giao diện bên ngoài dùng Geist như hiện nay.
