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
| 4.6 | Giảm dung lượng và thời gian tải model | Xem mục "Kế hoạch bước 4.6" bên dưới |
| 4.7 | Tay tự nhiên hơn: tư thế nghỉ và chuyển động nhẹ theo trạng thái (hướng A, viết bằng code) | Xem mục "Kế hoạch bước 4.7" bên dưới |
| 4.8 | Chuyển động mượt hơn mà không tăng fps (để máy không nóng thêm) | Xem mục "Kế hoạch bước 4.8" bên dưới |

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

**Tình trạng:**

- Đạt ngân sách hiệu năng: tạm coi là xong.
- Máy yếu tự vào bậc nhẹ: tạm coi là xong.
- Bậc dự phòng 2D: **để lại.** Đã kiểm tra bằng Chrome headless tắt WebGL, chưa kiểm
  tra trên thiết bị thật vì chưa có máy test. Cần làm khi có máy: nghe miệng đổi ảnh
  theo giọng bot thật, chỉnh ngưỡng `SMALL_*`/`WIDE_*`, đánh giá độ cứng (nếu quá cứng
  thì xem lại Live2D, xem 4.4), thử `?tier=sprite`.

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

**Chọn: sprite 2D.** Không dùng Live2D. Ảnh được chụp từ chính trang avatar 3D (xem 4.5), không dựng bằng Blender.

Lý do:

- Bậc này phải chạy được khi WebGL không dùng được (điều kiện xong của 4.5).
  Live2D bản Web render bằng WebGL, nên hỏng cùng chỗ với bản 3D. Sprite chỉ cần
  `<img>`/CSS/canvas 2D.
- Dùng lại `AvatarSample_E.vrm`, cùng nhân vật với bản 3D. Live2D cần một model
  `.moc3` riêng (vẽ và rigging bằng Cubism Editor), không chuyển được từ VRM.
- Không ràng buộc giấy phép của Cubism. Giấy phép của `AvatarSample_E.vrm` đã
  kiểm tra, xem "Giấy phép model" bên dưới.
- Gần như không tốn CPU/GPU, dung lượng chỉ vài chục ảnh nhỏ.

Đánh đổi chấp nhận: chuyển động hạn chế (đổi ảnh). Miệng phải gom về vài mức
rời rạc (khoảng 3–5 ảnh) thay vì độ mở liên tục; mỗi biểu cảm cần một bộ ảnh
riêng.

Việc kế tiếp (4.5): dựng thử vài ảnh miệng và biểu cảm để đánh giá bằng mắt xem
có quá cứng không, rồi làm bậc dự phòng và kiểm tra khi tắt WebGL. Nếu quá cứng
thì xem lại Live2D như một bậc giữa, không thay cho bậc dự phòng này.

## Kế hoạch bước 4.6 (giảm dung lượng và thời gian tải model)

Lý do: lần đầu tải model chậm. `AvatarSample_E.vrm` nặng 17,9 MB, trong đó 14,3 MB (80%) là
28 ảnh texture PNG, hình học chỉ ~3,6 MB. PNG đã nén sẵn nên gzip gần như không giảm (còn
~15 MB). Đây là các mục "Chưa" ở bảng 4.2 (KTX2/meshopt, bản low-poly), nay có số liệu để
chọn thứ tự. Các con số này đọc từ file, **chưa đo thời gian tải thật**.

Làm theo thứ tự, dừng khi đủ nhanh; không cần làm hết.

| # | Việc | Ghi chú |
|---|---|---|
| 4.6.0 | Đo: thời gian tải file qua Tailscale từ điện thoại; thời gian từ tải xong đến `onReady` | Bắt buộc làm trước. Nếu thời gian chủ yếu nằm ở giải mã và đưa lên GPU thì ưu tiên giảm kích thước texture |
| 4.6.1 | Bỏ `Thumbnail`, nén texture sang WebP, **giữ 2048** (chỉ giảm 1024 nếu sau này thấy thiếu RAM trên iPhone) | Ước tính 17,9 MB còn ~4 đến 5 MB. Lưu thành file riêng `AvatarSample_E.web.vrm`, **không ghi đè** `AvatarSample_E.vrm` gốc. Xem "Thông tin cho 4.6.1" bên dưới. Cần so mắt màu và MToon |
| 4.6.2 | Preload: bắt đầu tải model khi vào màn hình, không đợi bật avatar | Không giảm dung lượng nhưng giấu thời gian chờ |
| 4.6.3 | Phục vụ bản build (`apps/web/dist`) thay cho Vite dev server | Bắt buộc trước khi đo ở phase 5.6 |

Chỉ làm khi 4.6.1 đến 4.6.3 vẫn chưa đạt:

- KTX2 (Basis): nhẹ GPU nhất, nhưng cần thêm `KTX2Loader` và transcoder.
- meshopt: chỉ giảm phần hình học ~3,6 MB, lợi ích ít.
- Bản low-poly hoặc model nhỏ hơn cho bậc nhẹ (`chibi03`, `Mocking_Spit_Strawberry` ~5,7 MB): giấy phép chưa kiểm tra.

**Xong khi:** có số dung lượng và thời gian tải trước và sau trên điện thoại qua Tailscale,
hình nhìn không xấu đi so với bản gốc, và ghi lại kết quả ở mục này.

Giấy phép `AvatarSample_E` đã kiểm tra cho phép chỉnh sửa (xem "Giấy phép model").

### Thông tin cho 4.6.1

Đọc từ phần JSON của `AvatarSample_E.vrm` (file 17,1 MiB): 28 ảnh PNG chiếm 13,6 MiB, phần còn lại
(hình học và dữ liệu khác) ~3,5 MiB.

| Nhóm texture | Dung lượng | Ghi chú |
|---|---|---|
| `F00_002_Body_00`, `F00_002_Onepiece_01`, `F00_002_02_Body_00_nml` (2048×2048) | ~8 MiB | Lớn nhất; `_nml` là normal map |
| `Thumbnail` (2048×2048) | 2,7 MiB | Chỉ là ảnh đại diện của VRM, khi render không dùng: **bỏ hẳn** |
| Face, HairBack, Hair, EyeWhite, Shoes, EyeIris… (1024 và 512) | ~3 MiB | Giữ kích thước, đổi WebP |

Phương án: bỏ `Thumbnail`, đổi toàn bộ texture sang WebP, giữ nguyên kích thước 2048. Lý do: ở 4.6.0
mạng chiếm ~89% thời gian, giải mã và hiện hình chỉ ~0,84 s.

Rủi ro cần kiểm:

- WebP trong VRM (`EXT_texture_webp`) không phải chuẩn VRM; three.js `GLTFLoader` đọc được nên
  không phải đổi loader, nhưng viewer VRM khác có thể không mở được. Bản gốc được giữ.
- Normal map (`_nml`) nén lossy dễ làm hỏng vân sáng tối: dùng chất lượng cao (90 trở lên).
- So mắt màu da và MToon giữa bản gốc và bản mới; đo lại bằng đoạn tạm trong `avatar-test.tsx`
  để có số "sau" cùng cách đo với số "trước" bên dưới.
- Công cụ: `@gltf-transform/cli` kèm `sharp`, chạy bằng `npx` ngoài dự án (không thêm vào `package.json`).

### Kết quả đo trước (bước 4.6.0, làm một phần)

Đo trên iPhone, mạng **5G**, qua Tailscale tới Vite dev server (không phải bản build), bằng trang
`/?avatar-test` (trang chính `/` trắng khi vào bằng IP vì không phải secure context, xem dưới).
Mới đo **hai lần**. Đường Tailscale kiểm tra sau khi đo: **relay** (DERP `sin`, độ trễ 83 đến 194 ms, chưa có kết nối trực tiếp), nên tốc độ mạng chậm và dao động; kết nối trực tiếp có thể nhanh hơn.

| Model | Dung lượng | Thời gian tải | Tốc độ |
|---|---|---|---|
| `Mocking_Spit_Strawberry.vrm` | ~5,7 MB | 2 s | ~2,8 MB/s |
| `AvatarSample_E.vrm` | ~17,9 MB | 6,63 s | ~2,7 MB/s |

- Tốc độ gần bằng nhau ở hai file nên thời gian tải tỉ lệ với dung lượng: nút thắt là băng thông,
  giảm dung lượng sẽ giảm thời gian tương ứng. Với ~2,7 MB/s, mục tiêu 3 đến 5 MB tương ứng khoảng
  1,1 đến 1,9 s.
- **Thời gian từ tải xong đến hiện hình** (đo bằng đoạn tạm trong `avatar-test.tsx`, hai lần,
  iPhone, 5G, `AvatarSample_E`):

  | | Lần 1 | Lần 2 | Trung bình |
  |---|---|---|---|
  | Tải mạng | 6708 ms | 7598 ms | ~7150 ms |
  | Tải xong → parse xong | 253 ms | 254 ms | ~254 ms |
  | Parse xong → khung đầu | 587 ms | 654 ms | ~620 ms |
  | **Tải xong → hiện hình** | 840 ms | 908 ms | ~875 ms |

  Giải mã và hiện hình ~11% tổng. Mạng chiếm ~89% nên ưu tiên giảm
  dung lượng truyền (WebP, bỏ Thumbnail); chưa cần giảm texture xuống 1024 vì lý do thời gian tải.
- **Bộ nhớ texture (ước lượng tính từ kích thước ảnh, RGBA 8 bit, có mipmap; không phải số đo):**
  27 texture dùng khi render ~117 MB, thêm `Thumbnail` nếu bị nạp ~138 MB, nếu hạ 3 texture 2048
  xuống 1024 còn ~69 MB (giảm ~48 MB). WebP chỉ giảm dung lượng truyền, **không giảm** số này vì
  texture được giải nén thành ảnh thô. Trên iPhone 15 Pro Max mức ~117 MB chưa là vấn đề; hạ 1024
  là phương án dự phòng cho máy yếu hơn.
- **Chưa đo:** lần thứ ba, bản build; bộ nhớ thật trên iPhone (Web Inspector không thấy
  mục Memory ở tab Timelines trên bản Safari đang dùng; chỉ có ước lượng ở trên).
- **Đoạn đo tạm:** `avatar-test.tsx` có hàm `showTiming` (chưa commit, in kết quả ở cuối màn hình)
  để đo lại sau 4.6.1 bằng đúng link:
  `http://<ip>:5173/?avatar-test&model=/avatars/AvatarSample_E.web.vrm`. Gỡ sau khi đo xong.
- Ghi chú khi đo: `/?avatar-test` mặc định tải `Mocking_Spit_Strawberry`, phải thêm
  `&model=/avatars/AvatarSample_E.vrm` để đo model đang dùng ở trang chính (trang chính đọc
  `VITE_AVATAR_URL` trong `apps/web/.env.local`).
- Trang chính `/` trắng khi vào bằng `http://<ip>:5173`: `App.tsx` chỉ render khi client Pipecat
  đã được tạo, và việc này thất bại khi không phải secure context (suy ra từ code, chưa đọc
  thông báo lỗi); `error` không được hiện khi `client` còn `null`. Vào bằng `localhost` thì bình
  thường. Muốn đo trang chính trên điện thoại cần HTTPS (`tailscale serve`).

## Kế hoạch bước 4.7 (tay tự nhiên hơn)

Hiện trạng (đọc từ code): tay chỉ được hạ một góc cố định `ARM_RAD` (58°) bằng cách đặt
`leftUpperArm.rotation.z` và `rightUpperArm.rotation.z` một lần để thoát tư thế chữ T
(`avatar-stage.tsx:249-252`, `sprite-capture.tsx:70-73`). Không có cẳng tay, khuỷu, bàn tay
hay vai, và tay không đổi theo trạng thái hay lời nói, nên trông cứng.

**Chọn hướng A (viết bằng code)**, vì nhẹ, không thêm file clip hay phụ thuộc, hợp với bậc nhẹ,
và cùng nhóm với mục "chuyển động nhàn rỗi" đang chưa làm. Sửa ở web nên mobile (phase 5)
hưởng luôn qua WebView.

| # | Việc | Ghi chú |
|---|---|---|
| 4.7.0 | Kiểm tra model có đủ bone `leftLowerArm`, `rightLowerArm`, `leftHand`, `rightHand`, `leftShoulder`, `rightShoulder` | VRM humanoid chuẩn thì có; chưa kiểm tra trên `AvatarSample_E` |
| 4.7.1 | Tư thế nghỉ: hạ tay khỏi chữ T bằng cả vai và cánh tay, gập nhẹ khuỷu, bàn tay thả lỏng | Thay cho một góc `ARM_RAD` duy nhất. Giá trị chỉnh bằng mắt |
| 4.7.2 | Nhịp thở: vai nhún nhẹ, tay đung đưa rất nhỏ theo nhịp | Dùng chung bộ định thời với chuyển động nhàn rỗi |
| 4.7.3 | Theo trạng thái: nói thì tay cử động nhẹ theo mức miệng, nghĩ thì nâng tay hơi gập, nghe thì tay yên | Trạng thái lấy từ `use-avatar-state.ts`, chuyển mượt bằng `damp` sẵn có |
| 4.7.4 | Cập nhật khung camera và chụp lại sprite | Tư thế tay đổi thì `vrm-frame.ts` (bề ngang vai và tay) phải kiểm tra lại, và 16 ảnh sprite phải chụp lại bằng `node tools/capture-sprites.mjs` để khớp bản 3D |

**Xong khi:** bản 3D có tư thế nghỉ tự nhiên và tay chuyển động nhẹ theo trạng thái mà không
tốn rõ rệt fps ở bậc nhẹ; khung camera không cắt tay; sprite khớp tư thế mới.

### Hướng B (để phát triển sau, chưa làm)

Dùng clip Mixamo (idle, nói chuyện, nghĩ) retarget sang VRM bằng `@pixiv/three-vrm-animation`,
đúng hướng "Mixamo + idle viết bằng code" ở README.

- Ưu: tự nhiên nhất; làm được cử chỉ như tay chạm cằm ở trạng thái `thinking` (phase 1 đã gợi ý).
- Nhược: thêm file clip và công retarget; nặng hơn cho máy yếu và cho bậc nhẹ; thêm phụ thuộc
  (ghim phiên bản theo quy tắc chuỗi cung ứng); cần kiểm tra giấy phép của từng clip Mixamo.
- Khi nào nên chuyển sang: nếu sau 4.7 tay vẫn bị đánh giá là cứng, hoặc muốn cử chỉ phong phú
  (vẫy tay, chỉ tay, chạm cằm).
- Có thể kết hợp: giữ hướng A làm tư thế nền và nhịp thở, chỉ dùng clip cho vài cử chỉ.
- Với bậc sprite, hướng B không giúp được vì sprite chỉ là ảnh tĩnh; cần chụp thêm ảnh cho từng
  cử chỉ.

## Kế hoạch bước 4.8 (mượt hơn mà không tăng fps)

Mục tiêu: chuyển động nhìn mượt hơn mà nhiệt và pin không tăng, vì tăng fps làm máy nóng.
Cảm giác mượt phụ thuộc cả độ đều của khung và độ êm của chuyển động, không chỉ số fps.

Hiện trạng (đọc từ code, chưa đo):

- Đã có: mọi chuyển động trong `useFrame` tính theo `dt` thực (`damp(..., dt)`, `nodPhase += dt`,
  `b.t += dt`, `vrm.update(dt)`); `FrameDriver` lập lịch cộng dồn theo `interval` nên fps trung bình đúng.
- Chưa có: fps chỉ chia hai mức (`idle` và còn lại); bậc sprite không có crossfade (không thấy
  `transition` trong `sprite-stage.tsx`).
- Rủi ro (suy luận từ code, **chưa thử**): khi iOS ép rAF xuống 30 Hz (chế độ tiết kiệm pin) mà đích là
  20 fps, khung có thể rơi vào các mốc cách nhau 66 ms rồi 33 ms thay vì đều 50 ms, gây giật.

| # | Việc | Xong khi |
|---|---|---|
| 4.8.0 | Đo nền: nhiệt và pin sau 10 phút ở từng bậc, kèm độ đều của khung (khoảng cách giữa các lần `invalidate`) | Có số liệu để so trước và sau |
| 4.8.1 | Kiểm tra nhịp khung của `FrameDriver` khi rAF chạy 30 Hz | Biết bậc nhẹ (20 fps) có lệch nhịp không; nếu có thì chọn fps là ước số của tần số quét |
| 4.8.2 | Fps theo hoạt động: thêm một mức giữa cho "đang nghe, tư thế yên", chuyển mức dần | Nhiệt giảm so với 4.8.0, không khựng khi đổi mức |
| 4.8.3 | Chuyển động chung bằng CSS: nhịp thở và đung đưa nhẹ của cả khung chạy bằng `transform` | Mượt 60 fps mà không tăng số khung vẽ 3D |
| 4.8.4 | Crossfade cho bậc sprite: chuyển mềm giữa ảnh miệng và biểu cảm | Bậc sprite hết cảm giác đổi ảnh tức thì |
| 4.8.5 | So sánh trước và sau: nhiệt, pin, đánh giá bằng mắt | Nhiệt và pin không tăng, chuyển động nhìn đều hơn |

Làm 4.8.0 và 4.8.1 trước (đo và kiểm tra, không đổi code), rồi chọn 4.8.2 đến 4.8.4 theo số đo; việc
nào số đo cho thấy không cần thì bỏ.

Lưu ý:

- 4.8.3 không làm miệng hay xương mượt hơn, chỉ hợp chuyển động chung của khung; với lip-sync thì
  30 fps đã đủ mượt.
- 4.8.2: đổi fps đột ngột có thể thấy khựng nên phải chuyển dần.
- 4.8.4 nên làm cùng lúc với việc đánh giá độ cứng của sprite đang chờ ở 4.5.
- Liên quan 4.6 (giảm chi phí mỗi khung) và 4.7 (nhịp thở của tay): nên làm 4.7.2 và 4.8.3 cùng một
  chỗ để khỏi trùng, và đo nhiệt chung ở 4.6.0 và 4.8.0.
- Ngoài phạm vi: nội suy mức âm phía mobile đã nằm ở bước 5.3.

**Xong khi:** có số đo nhiệt và pin trước và sau, nhiệt và pin không tăng, và chuyển động nhìn đều
hơn ở cả bậc 3D lẫn sprite.

## Kết quả bước 4.3 (chọn bậc tự động)

Code ở `components/avatar/quality.ts` và `avatar-stage.tsx`.

- Bậc ban đầu: `?tier=` > giá trị nhớ trong `localStorage` (`avatar-tier`) > đoán theo máy
  (`hardwareConcurrency <= 4` hoặc `deviceMemory <= 4` thì vào bậc nhẹ).
- Hạ bậc: `PerformanceMonitor` (ngưỡng `fps*0.7`), chờ 4 s sau khi model nạp, không đo lúc `idle`,
  tab ẩn hoặc có `?fps=`. Đường hạ một chiều: đầy đủ → nhẹ → sprite 2D, mỗi bước đều nhớ lại.
  Bậc nhẹ vẫn tụt thì `AvatarStage` gọi `onLowFps`, `voice-screen.tsx` chuyển sang `SpriteStage`.
- Đã kiểm tra: `tsc` và `vite build` qua.
- **Chưa kiểm tra:** chưa thử thật việc tụt fps rồi tự hạ (cả hai bước) trên máy yếu; ngưỡng đoán theo
  máy hơi chặt (`deviceMemory` bị Chrome giới hạn tối đa 8, nhiều máy mạnh báo 4) nên bậc đầy đủ có
  thể ít được dùng. Muốn thử lại bước hạ: xoá khoá `avatar-tier` trong `localStorage`.

## Kết quả bước 4.5 (bậc sprite 2D)

Nguồn ảnh: chụp từ trang 3D thay vì Blender (máy chưa cài Blender). Cách này khớp bản
3D hơn (cùng shader MToon, cùng khung camera, cùng model) nhưng ảnh kém mịn và kém
linh hoạt hơn render Blender. Muốn ảnh đẹp hơn thì thay bằng ảnh Blender, giữ nguyên tên
file và kích thước, không phải sửa code.

| Phần | Nơi |
|---|---|
| Danh mục sprite (tên, mức miệng, kích thước) | `components/avatar/sprites.ts` |
| Trang chụp `/?avatar-sprites` (dựng từng tổ hợp, xuất WebP nền trong suốt) | `components/avatar/sprite-capture.tsx` |
| Chạy chụp tự động bằng Chrome headless, lưu vào `public/avatars/sprites/` | `tools/capture-sprites.mjs` (cần `npm run dev`) |
| Khung nửa người trên dùng chung với bản 3D | `components/avatar/vrm-frame.ts` |
| Component sprite | `components/avatar/sprite-stage.tsx` |
| Chọn bậc: không có WebGL, hoặc ép bằng `?tier=sprite` | `hasWebGL()`, `shouldUseSprite()` ở `quality.ts`; nối ở `voice-screen.tsx` |

- Bộ ảnh: 5 biểu cảm (`neutral`, `happy`, `sad`, `surprised`, `thinking`) × 3 mức miệng
  (`closed`, `small`, `wide`) + 1 ảnh chớp mắt = 16 ảnh WebP 480×640, mỗi ảnh ~38 KB
  (tổng ~600 KB). Chụp lại: `node tools/capture-sprites.mjs`.
- Mức miệng lấy từ cùng bộ phân tích âm thanh với bản 3D (`useAvatarLipsync`), cộng các
  viseme lại rồi chia ngưỡng có độ trễ, cập nhật 20 lần/giây.
- Đã kiểm tra: Chrome headless tắt WebGL hiện sprite (0 canvas, ảnh nạp xong), bật WebGL vẫn
  dùng avatar 3D; `tsc` và `vite build` qua; ảnh chụp khớp khung và màu bản 3D.
- **Chưa kiểm tra:** miệng đổi ảnh theo giọng bot thật (mới kiểm tra ảnh tĩnh); các ngưỡng
  `SMALL_*`/`WIDE_*` là giá trị đoán ban đầu; trên thiết bị thật; độ cứng của chuyển động
  khi đổi ảnh (điều kiện "quá cứng thì xem lại Live2D" ở 4.4 chưa đánh giá).
- Đã nối: tự hạ từ bậc nhẹ xuống sprite khi fps vẫn thấp (xem 4.3). Chưa làm: chuyển động nhàn rỗi (thở, nghiêng đầu).

## Giấy phép model

Đọc từ metadata nhúng trong `AvatarSample_E.vrm` (model mẫu "ビビ"/Vivi, tác giả
VRoidプロジェクト), kiểm tra ngày 2026-11-03.

| Mục | Giá trị |
|---|---|
| Ai được dùng | Everyone |
| Thương mại | Allow (doanh nghiệp `allow`, cá nhân `profit`) |
| Chỉnh sửa | Allow |
| Phân phối lại | Allow |
| Ghi nguồn | Không cần |
| Bạo lực / tình dục | Allow |

- Dùng thương mại, chỉnh sửa (gồm render thành sprite) và commit sprite lên repo đều
  được phép. File `.vrm` bị gitignore nên không nằm trong repo.
- Điều khoản đọc từ tham số của URL giấy phép trong metadata
  (`hub.vroid.com/license?...`), chưa mở trang đó để đối chiếu. Cần chắc chắn về mặt
  pháp lý thì nên mở URL kiểm lại.
- Chưa kiểm tra: `AvatarSample_D`, `chibi03`, `Mocking_Spit_Strawberry` (đây là model
  mặc định của code khi không đặt `VITE_AVATAR_URL`).
