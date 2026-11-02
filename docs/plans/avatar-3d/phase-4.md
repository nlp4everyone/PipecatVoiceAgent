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

## Kết quả đo (bước 4.1)

Đo bằng `?avatar-fps` (hiện fps) và `?fps=` (ép fps, tắt tự hạ bậc). `?fps=0` vẽ
theo nhịp màn hình.

| Thiết bị | Bậc | Giới hạn mặc định | `?fps=0` (không giới hạn) |
|---|---|---|---|
| iPhone 15 Pro Max | full (high) | 30 fps | 60 fps (trần màn hình) |
| iPhone 15 Pro Max | light | 20 fps | 60 fps (trần màn hình) |

- Cả hai bậc đạt 60 fps, nên mức 30/20 fps là do mình đặt, không phải do máy
  kéo không nổi. Máy còn dư sức.
- 60 fps là trần màn hình nên chưa cho biết dư địa thật (xem thêm bằng thời gian
  mỗi khung hoặc nhiệt/pin).
- Chưa đo: máy yếu, desktop, pin và nhiệt sau 10 phút gọi.

## Kết quả rà biện pháp (bước 4.2)

Model đang dùng: `AvatarSample_E.vrm` (đặt bằng `VITE_AVATAR_URL` trong
`apps/web/.env.local`; mặc định của code là `Mocking_Spit_Strawberry.vrm`).

Số liệu model E: 17,5 MB; 3 mesh (Face 3.150 tam giác, Body 11.880, Hair 11.676,
tổng ~27k); 95 primitive; 16 material MToon; Hair có ~729k đỉnh cho 11,7k tam giác.

| Biện pháp | Trạng thái |
|---|---|
| `frameloop="demand"`, hạ fps khi im lặng | Có |
| Dừng khi tab ẩn | Có |
| `dpr` 1.5 (nhẹ: 1) | Có |
| Tắt spring bones ở bậc nhẹ | Có |
| `PerformanceMonitor` + kiểm tra phần cứng | Có |
| Không shadow / post-processing | Có |
| Nút tắt 3D | Có (nút quả cầu/avatar ở `voice-screen.tsx`, từ phase 1) |
| Tắt outline MToon ở bậc nhẹ | Có (`TierConfig.outline`); 4 material có outline (Face, Body, Onepice, Shoes) |
| Chỉ render nửa người trên | Chưa. Body là mesh riêng nhưng chứa cả thân; cần cắt hoặc ẩn phần dưới |
| Bản low-poly (~15k) | Chưa. Model E ~27k tam giác, 95 primitive (nhiều draw call) |
| KTX2 / meshopt | Chưa. File 17,5 MB; Hair ~729k đỉnh |

Chưa đo bậc nhẹ sau khi tắt outline, và chưa đo trên máy yếu.

## Quyết định bậc dự phòng 2D (bước 4.4)

**Chọn: sprite dựng từ Blender.** Không dùng Live2D.

Lý do:

- Bậc này phải chạy được khi WebGL không dùng được (điều kiện xong của 4.5).
  Live2D bản Web render bằng WebGL, nên hỏng cùng chỗ với bản 3D. Sprite chỉ cần
  `<img>`/CSS/canvas 2D.
- Dùng lại `AvatarSample_E.vrm`, cùng nhân vật với bản 3D. Live2D cần một model
  `.moc3` riêng (vẽ và rigging bằng Cubism Editor), không chuyển được từ VRM.
- Không ràng buộc giấy phép của Cubism. Chỉ còn phải kiểm tra giấy phép của
  `AvatarSample_E.vrm` có cho dùng thương mại và render thành ảnh không (việc này
  áp dụng cho cả bản 3D).
- Gần như không tốn CPU/GPU, dung lượng chỉ vài chục ảnh nhỏ.

Đánh đổi chấp nhận: chuyển động hạn chế (đổi ảnh). Miệng phải gom về vài mức
rời rạc (khoảng 3–5 ảnh) thay vì độ mở liên tục; mỗi biểu cảm cần một bộ ảnh
riêng.

Việc kế tiếp (4.5): dựng thử vài ảnh miệng và biểu cảm để đánh giá bằng mắt xem
có quá cứng không, rồi làm bậc dự phòng và kiểm tra khi tắt WebGL. Nếu quá cứng
thì xem lại Live2D như một bậc giữa, không thay cho bậc dự phòng này.
