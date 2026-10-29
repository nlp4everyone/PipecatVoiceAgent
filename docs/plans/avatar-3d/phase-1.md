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

### Chưa kiểm tra

- Chưa gọi bot thật nên chưa thấy `connecting / listening / thinking / speaking`.
- Chưa thử chuyển quả cầu / avatar giữa lúc đang gọi.
- Chưa đo fps khi gọi bot (WebRTC, audio chạy song song với canvas).
- Chưa chốt model dùng lâu dài (xem phase 0.3); Mocking Spit luôn há miệng rộng
  nên lip-sync ở phase 2 sẽ khó thấy.
- `avatar-test.tsx` còn lặp ~40 dòng chuẩn bị model với `avatar-stage`; chưa gộp.

## Xong phase 1

- [x] 1.1 `avatar-stage` hiển thị trong khung `voice-screen`.
- [x] 1.2 Mỗi trạng thái có tư thế riêng (chưa thử với bot thật).
- [x] 1.3 Chuyển quả cầu / avatar bằng nút, không kết nối lại (chưa thử giữa cuộc gọi).
- [x] 1.4 Nạp lazy, three.js không vào bundle chính.
- [x] 1.5 Quả cầu vẫn chạy (đã xem ảnh; chưa thử gọi bot).
- [ ] Gọi bot thật, avatar đổi tư thế theo trạng thái.
