# Giai đoạn 4 — Hiệu năng và các bậc chất lượng

Mục tiêu: avatar chạy ổn trên máy yếu; máy tự chọn bậc phù hợp và tự hạ bậc khi
fps rớt. Có nút tắt 3D để quay về quả cầu.

## Biện pháp

| Biện pháp | Tác dụng |
|---|---|
| Chỉ render nửa người trên | Giảm tam giác và xương |
| Giới hạn 30 fps (20 ở bậc nhẹ) | Giảm GPU và nhiệt |
| `frameloop="demand"`, hạ fps khi bot im lặng | Tiết kiệm khi avatar đứng yên |
| Dừng render khi tab ẩn / app xuống nền | Tiết kiệm pin |
| Tắt outline MToon, shadow, post-processing | Outline vẽ mesh hai lần |
| Tắt spring bones ở bậc nhẹ | Bỏ chi phí CPU của vật lý |
| Nén texture KTX2, hình học Draco/meshopt | File nhỏ, ít tốn RAM GPU |
| Bản low-poly riêng (~15k tam giác) cho bậc nhẹ | Làm trong Blender |
| Giới hạn `dpr` ở 1.5 (bậc nhẹ: 1) | Giảm số điểm ảnh |
| `PerformanceMonitor` của `drei` + kiểm tra `hardwareConcurrency`, `deviceMemory`, WebGL2 | Tự chọn và hạ bậc |
| Nút tắt 3D trong cài đặt | Người dùng tự quay về quả cầu |

## Các bước

| # | Việc | Xong khi |
|---|---|---|
| 4.1 | Đặt bộ đếm fps và ghi lại fps theo bậc | Có bảng số liệu theo thiết bị |
| 4.2 | Áp dụng các biện pháp trên | Đạt ngân sách trong README |
| 4.3 | Chọn bậc tự động và hạ bậc khi fps rớt | Máy yếu tự vào bậc nhẹ |
| 4.4 | Chọn bậc dự phòng 2D: sprite từ Blender **hoặc** Live2D | Có quyết định, ghi lý do |
| 4.5 | Làm bậc dự phòng 2D đã chọn | Hoạt động khi WebGL không dùng được |

### 4.4 Chọn giữa sprite và Live2D

| | Sprite từ Blender | Live2D |
|---|---|---|
| Model | Dùng chung với bản 3D | Cần model Live2D riêng |
| Nhẹ | Nhẹ nhất | Rất nhẹ |
| Chuyển động | Hạn chế (đổi ảnh) | Mượt, có chiều sâu |
| Giấy phép | Không ràng buộc | Cubism có điều khoản riêng, cần đọc |

Mặc định nghiêng về sprite vì nhất quán với bản 3D, trừ khi hình ảnh quá cứng.

**Xong khi:** đạt ngân sách trong README trên thiết bị thật, máy yếu tự vào bậc
nhẹ, và bậc dự phòng hoạt động khi không có WebGL.
