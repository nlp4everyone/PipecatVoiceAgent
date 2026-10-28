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
