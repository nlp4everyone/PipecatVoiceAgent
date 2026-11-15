# Giai đoạn 1 — Tích hợp vào web, chuyển qua lại với quả cầu

Mục tiêu: trong `apps/web`, gọi bot và thấy avatar đổi tư thế theo trạng thái
hội thoại; chuyển được giữa quả cầu và avatar; quả cầu vẫn chạy đúng như cũ.

## Cấu trúc

```
apps/web/src/components/
  chat-orb.tsx              giữ nguyên
  avatar/                   mới
    avatar-stage.tsx        canvas R3F, nạp VRM, camera nửa người
    use-avatar-state.ts     trạng thái hội thoại → animation
```

Đây là cấu trúc lúc làm phase 1. Thư mục `avatar/` hiện có thêm nhiều file ở các phase sau:

```
  avatar/
    avatar-error-boundary.tsx   rơi về quả cầu khi avatar nạp lỗi
    preload.ts                  dùng lại model đã tải sớm (4.6.2)
    quality.ts                  chọn và hạ bậc (4.3)
    sprite-stage.tsx, sprites.ts   bậc sprite 2D (4.5)
    vrm-frame.ts                khung camera, tư thế tay (4.7)
    use-avatar-lipsync.ts       lip-sync (phase 2)
    avatar-test.tsx, expression-test.tsx, pose-test.tsx, sprite-capture.tsx   trang thử và chụp sprite
```

`voice-screen.tsx` chọn giữa quả cầu và avatar. `avatar-stage` nạp bằng
`React.lazy` nên người chỉ dùng quả cầu không phải tải three.js.

## Các bước

| # | Việc | Xong khi |
|---|---|---|
| 1.1 | Tạo `avatar-stage` từ trang thử của phase 0, camera nửa người trên | Hiển thị trong khung của `voice-screen` |
| 1.2 | Ánh xạ trạng thái `idle / connecting / listening / thinking / speaking` (kiểu `OrbState` hiện có) sang animation | Mỗi trạng thái có tư thế riêng |
| 1.3 | Thêm tuỳ chọn chuyển quả cầu / avatar (cài đặt và biến môi trường Vite) | Đổi được cả trước và trong lúc gọi, không kết nối lại |
| 1.4 | Nạp avatar bằng `React.lazy`, có trạng thái chờ | Build web không kéo three.js vào bundle chính |
| 1.5 | Chạy lại chế độ quả cầu | Quả cầu không hỏng |

Gợi ý ánh xạ trạng thái (điều chỉnh khi thử):

| Trạng thái | Gợi ý |
|---|---|
| `idle` | Thở, chớp mắt, nhìn quanh nhẹ |
| `connecting` | Nhìn vào camera, gật nhẹ |
| `listening` | Nghiêng đầu nhẹ, nhìn vào camera |
| `thinking` | Nhìn lên hoặc nghiêng, tay chạm cằm nếu có clip |
| `speaking` | Cử động nhẹ, miệng theo giọng (phase 2) |

**Xong khi:** gọi bot, avatar đổi tư thế theo trạng thái; chuyển qua lại với
quả cầu mượt; build không kéo three.js vào bundle chính.

## Kết quả

### 1.1 `avatar-stage`

`components/avatar/avatar-stage.tsx`: canvas R3F, nạp VRM, camera nửa người trên
tính từ các đỉnh sau khi skin (box bind pose lệch nhiều). Model lấy từ
`VITE_AVATAR_URL`, mặc định `/avatars/Mocking_Spit_Strawberry.vrm` (file không
nằm trong repo, xem phase 0.3). Khung hình vừa cả chiều cao lẫn chiều ngang;
box tính lúc tay còn dang chữ T mà tay hạ xuống sau đó nên chỉ lấy 85% bề
ngang (0.7 vẫn cắt đầu tay ở khung 256×320, 1.0 làm avatar quá nhỏ).

### 1.2 Trạng thái → tư thế

`components/avatar/use-avatar-state.ts`: bảng `AVATAR_POSES` theo `OrbState`
(nghiêng đầu, cúi/ngẩng, điểm nhìn, gật, lắc người, nhịp thở, cảm xúc). Tư thế
nằm trong ref nên đổi trạng thái không làm canvas render lại. Mic tắt thì chuyển
động giảm một nửa và mặt trung tính. Các góc là giá trị đoán, **chưa chỉnh với
bot thật**.

### 1.3 Chuyển quả cầu / avatar

Nút ở header `voice-screen.tsx` (hiện cả trước và trong lúc gọi). Chỉ đổi phần
hiển thị nên không kết nối lại. Lựa chọn lưu ở `localStorage` khoá
`voiceagent.visual`; chưa có thì lấy `VITE_DEFAULT_VISUAL` (`avatar` hoặc
quả cầu).

### 1.4 Nạp lazy

`AvatarStage` nạp bằng `React.lazy`. Ở bản build, `WebGLRenderer` chỉ nằm trong
chunk `GLTFLoader-*.js`, không có trong `index-*.js` và `index.html` không
preload chunk đó. Trong lúc model tải, màn hình hiện quả cầu nhỏ giữ chỗ.

### 1.5 Chế độ quả cầu

Nhánh quả cầu giữ nguyên props. Nếu avatar nạp lỗi thì tự quay về quả cầu và
hiện dòng báo.

### Đã kiểm tra

- `tsc -b` và `npm run build` qua.
- Chrome headless trên bản production: quả cầu và avatar đều hiện đúng, không
  có lỗi console. Dev server không dùng được trong headless vì phục vụ hàng
  trăm module three.js riêng lẻ nên quá chậm.
- iPhone qua `tailscale serve` (HTTPS, chỉ trong tailnet): avatar hiện.
- Gọi bot thật trên máy tính (dev server) và trên iPhone: cả hai đều ổn.
- Lỗi đã gặp trên iPhone qua dev server: chunk avatar (`React.lazy`) tải hỏng
  làm cả cây giao diện bị gỡ, màn hình đen và cuộc gọi chết theo. Đã thêm
  `AvatarErrorBoundary` để rơi về quả cầu (`dd2d617`).

### Chưa kiểm tra

- Chưa đo fps khi gọi bot (WebRTC, audio chạy song song với canvas).
- Chưa chốt model dùng lâu dài (xem phase 0.3); Mocking Spit luôn há miệng rộng
  nên lip-sync ở phase 2 sẽ khó thấy.
- `avatar-test.tsx` còn lặp ~40 dòng chuẩn bị model với `avatar-stage`; chưa gộp.

## Xong phase 1

- [x] 1.1 `avatar-stage` hiển thị trong khung `voice-screen`.
- [x] 1.2 Mỗi trạng thái có tư thế riêng (đã thử với bot thật).
- [x] 1.3 Chuyển quả cầu / avatar bằng nút, không kết nối lại.
- [x] 1.4 Nạp lazy, three.js không vào bundle chính.
- [x] 1.5 Quả cầu vẫn chạy (đã gọi bot thật).
- [x] Gọi bot thật, avatar đổi tư thế theo trạng thái.

## Cập nhật sau phase 4 (đối chiếu code 2026-11-15)

Phần "Kết quả" ở trên là ghi chép lúc làm phase 1, giữ nguyên như lịch sử. Các điểm dưới đây đã khác với code hiện tại.

- **Khung hình (1.1):** không còn lấy 85% bề ngang. `frameUpperBody` trong `vrm-frame.ts` lấy bề ngang theo khoảng cách vai nhân `ARM_ROOM` (4) và chiều cao theo `UPPER_BODY` (0,62) (4.7.4).
- **Tay (1.1, 1.2):** không còn một góc cố định `ARM_RAD`. Tay do `applyArmPose` và `REST_ARM` điều khiển (4.7.1); có ngón cong nhẹ, nhún vai theo nhịp thở, tay phải chống cằm ở `thinking`, khuỷu và cổ tay nhích theo mức miệng khi nói (4.7.1.1 đến 4.7.3b). `AVATAR_POSES` có thêm trường `armRight`, `sway`, `talk`.
- **Tư thế (1.2):** góc tay đã được chỉnh ở 4.7. Góc đầu (nghiêng, gật, nhìn) trong `AVATAR_POSES` không đổi từ commit đầu `c500a7b` (2026-10-29), tức chưa chỉnh riêng sau phase 1. Tuy vậy các tư thế đã chạy trong cuộc gọi thật (phase 3 ghi avatar "nghiêng đầu nhìn lên" khi bot gắn thẻ `thinking`) và không có phàn nàn nào về góc được ghi lại. Câu "chưa chỉnh với bot thật" ở trên là của lúc viết 1.2; mục tích "đã thử với bot thật" ở cuối file là kết quả sau đó, nên hai câu không thật sự mâu thuẫn. Chưa có xác nhận bằng lời về độ tự nhiên của từng tư thế.
- **Model:** mặc định trong code vẫn là `Mocking_Spit_Strawberry.vrm`, nhưng `apps/web/.env.local` đặt `VITE_AVATAR_URL` sang `AvatarSample_E.web.f17b1b4a.vrm`, nên bản chạy dùng `AvatarSample_E`. Các file `.vrm` không nằm trong repo (`public/avatars/*.vrm` bị gitignore); sprite `.webp` thì có trong repo. Chưa chốt model dùng lâu dài.
- **Ba bậc thay vì hai (1.3):** nút chuyển vẫn chỉ đổi quả cầu và avatar, nhưng avatar nay có bậc đầy đủ, bậc nhẹ và sprite 2D. Sprite chạy khi không có WebGL, hoặc khi bậc nhẹ vẫn tụt fps (4.3, 4.5).
- **Nạp lazy (1.4):** `SpriteStage` cũng nạp lazy. Model được tải sớm bằng một `fetch` chèn vào `<head>` từ `vite.config.ts`, và `preload.ts` dùng lại kết quả (4.6.2). Đó không phải `<link rel="preload">` và không preload chunk avatar, nên ý "`index.html` không preload chunk đó" vẫn đúng.
- **fps khi gọi bot:** đã đo ở phase 4 (4.1; iPhone 15 Pro Max đạt 60 fps, là trần màn hình), nên dòng "chưa đo fps" ở mục "Chưa kiểm tra" không còn đúng. Chưa đo nhiệt và pin.
- **Code lặp:** `avatar-test.tsx` vẫn dùng `GLTFLoader` trực tiếp còn `avatar-stage.tsx` dùng `AvatarLoader`; chưa gộp. Chưa đếm lại số dòng lặp.
