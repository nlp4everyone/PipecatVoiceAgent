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
| 4.6.3 | Phục vụ bản build (`apps/web/dist`) thay cho Vite dev server | Bắt buộc trước khi đo ở phase 5.6. **Chốt dùng `vite preview`** (chỉ FE, bot giữ nguyên). Caddy/nginx (nén, `Cache-Control`, proxy sang bot) để dành cho production sau này; không bot tự phục vụ `dist` |
| 4.6.4 | Cache file model: đặt `Cache-Control` cho `.vrm` khi phục vụ bản build, đo lần mở thứ hai | Làm sau 4.6.3 (cần server phục vụ `dist`). Xem "Kế hoạch 4.6.4" bên dưới |

Chỉ làm khi 4.6.1 đến 4.6.3 vẫn chưa đạt:

- KTX2 (Basis): nhẹ GPU nhất, nhưng cần thêm `KTX2Loader` và transcoder.
- meshopt: chỉ giảm phần hình học ~3,6 MB, lợi ích ít.
- Bản low-poly hoặc model nhỏ hơn cho bậc nhẹ (`chibi03`, `Mocking_Spit_Strawberry` ~5,7 MB): giấy phép chưa kiểm tra.

**Xong khi:** có số dung lượng và thời gian tải trước và sau trên điện thoại qua Tailscale,
hình nhìn không xấu đi so với bản gốc, và ghi lại kết quả ở mục này.

Giấy phép `AvatarSample_E` đã kiểm tra cho phép chỉnh sửa (xem "Giấy phép model").

### Kế hoạch 4.6.4 (cache file model, mức cơ bản)

Hiện trạng (đọc từ code, **chưa đo**): `useLoader(GLTFLoader, url)` (`avatar-stage.tsx:202`) chỉ cache
trong bộ nhớ của tab, tải lại trang là mất. `vite.config.ts` không đặt `Cache-Control`, không có
service worker. Các số đo ở 4.6.0 và 4.6.1 dùng tab riêng tư nên là thời gian lần đầu, không có cache.
Preload (4.6.2) chỉ giấu lần tải đầu; cache mới làm các lần sau không phải tải lại.

| # | Việc | Ghi chú |
|---|---|---|
| 4.6.4.0 | Đo lần mở thứ hai ở tab thường (không riêng tư) trên Safari iPhone với bản dev hiện tại | Biết trình duyệt đã tự cache theo heuristic chưa |
| 4.6.4.1 | Đặt `Cache-Control: public, max-age=31536000, immutable` cho `.vrm` ở server phục vụ `dist` | Chưa rõ server nào phục vụ `dist` (nginx, Caddy hay bot), chốt ở 4.6.3 |
| 4.6.4.2 | Đổi tên file khi nội dung đổi (thêm hash, ví dụ `AvatarSample_E.web.<hash>.vrm`) và cập nhật `VITE_AVATAR_URL` | Tên cố định + `immutable` sẽ giữ mãi bản cũ |
| 4.6.4.3 | Đo lần mở thứ hai trên Safari và trên WKWebView | Phase 5 chưa biết WKWebView có giữ cache giữa các lần mở app không (`phase-5.md`) |
| 4.6.4.4 | Nếu cache hay bị mất hoặc WKWebView không giữ: nâng cấp theo "Hướng phát triển sau" bên dưới | Chỉ làm khi số đo ở 4.6.4.3 cho thấy cần |

**Xong khi:** lần mở thứ hai không tải lại model (mạng gần 0 ms trong số đo), và ghi lại kết quả
trên Safari lẫn WebView ở mục này.

Lưu ý: mức cơ bản dựa vào cache HTTP của trình duyệt. Trên iOS, cache có thể bị xóa mà không báo
trước (chưa đo mức độ). Đổi tên file khi đổi model đang làm thủ công nên dễ quên.

#### Hướng phát triển sau (chưa làm)

- **Cache API hoặc IndexedDB do code quản lý.** Không phụ thuộc cơ chế xóa cache của iOS.
  Khi nào chuyển: số đo 4.6.4.3 cho thấy lần mở thứ hai hay phải tải lại.
- **Service worker.** Cache cả model lẫn file build, mở được khi mạng yếu. Nhược: thêm độ phức tạp,
  phải quản lý phiên bản cache. Khi nào chuyển: cần chạy khi mạng kém, hoặc cần cache nhiều file.
- **Hash tên file tự động.** Để Vite xử lý model như asset được import thay cho đổi tên thủ công.
  Nhược: phải đổi cách đặt file (`*.vrm` đang bị `.gitignore` và nằm trong `public/`). Khi nào
  chuyển: đã lỡ để lại bản cũ trong cache một lần.
- **Cache phía native.** Nếu WKWebView không giữ cache giữa các lần mở app (câu hỏi chưa kiểm
  chứng ở `phase-5.md`). Khi nào chuyển: chỉ khi đo trên WebView xác nhận mất cache.

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
- **Đoạn đo tạm:** hàm `showTiming` trong `avatar-test.tsx` đã gỡ sau khi đo xong 4.6.1 (không có trong git).
- Ghi chú khi đo: `/?avatar-test` mặc định tải `Mocking_Spit_Strawberry`, phải thêm
  `&model=/avatars/AvatarSample_E.vrm` để đo model đang dùng ở trang chính (trang chính đọc
  `VITE_AVATAR_URL` trong `apps/web/.env.local`).
- Trang chính `/` trắng khi vào bằng `http://<ip>:5173`: `App.tsx` chỉ render khi client Pipecat
  đã được tạo, và việc này thất bại khi không phải secure context (suy ra từ code, chưa đọc
  thông báo lỗi); `error` không được hiện khi `client` còn `null`. Vào bằng `localhost` thì bình
  thường. Muốn đo trang chính trên điện thoại cần HTTPS (`tailscale serve`).

### Kết quả bước 4.6.1 (WebP, bỏ Thumbnail)

Tạo `apps/web/public/avatars/AvatarSample_E.web.vrm` từ `AvatarSample_E.vrm` (file gốc giữ nguyên;
`*.vrm` bị `.gitignore` nên không vào repo). Cách làm: script Node dùng `sharp`, sửa thẳng file GLB
(không dùng `@gltf-transform/cli` vì nó có thể làm mất phần mở rộng `VRM`). Script chạy ngoài dự
án, không nằm trong repo. Cần tạo lại thì viết lại theo các bước sau:

- Bỏ texture `Thumbnail` (texture/image/bufferView cuối cùng) và đặt `extensions.VRM.meta.texture = -1`.
- Đổi 27 ảnh PNG sang WebP, giữ 2048: chất lượng 90, riêng `_nml` là 95.
- Mỗi texture dùng `EXT_texture_webp`, khai báo vào `extensionsUsed` và `extensionsRequired`.
- Dựng lại buffer, căn 4 byte, ghi lại GLB.

Kết quả đo trên iPhone, tab riêng tư (không cache), 4 lần mỗi bản, đường Tailscale vẫn là relay
(DERP `hkg`, trễ 89 đến 114 ms). Tốc độ mạng lần này thấp hơn lần đo 4.6.0 nên chỉ so sánh tỉ lệ:

| | Gốc | Bản WebP |
|---|---|---|
| Dung lượng | 17,9 MB | 4,47 MB (giảm 4,0 lần) |
| Tải mạng (trung bình) | ~16300 ms | ~4150 ms (giảm 3,9 lần) |
| Tốc độ | ~1,10 MB/s | ~1,08 MB/s |
| Tải xong → hiện hình | ~875 ms (4.6.0) | ~700 ms |
| Tổng | ~17,2 s | ~4,85 s |

- Tốc độ hai bản bằng nhau nên mức giảm đến từ dung lượng, đúng dự đoán ở 4.6.0.
- Giải mã WebP không làm chậm hiện hình, số còn thấp hơn bản PNG.
- So mắt màu da, tóc, mắt, MToon giữa hai bản: màu tương tự, không thấy khác biệt.
- Bộ nhớ texture trên GPU không đổi (~117 MB ước lượng), vì WebP chỉ giảm dung lượng truyền.
- `apps/web/.env.local` đã đặt `VITE_AVATAR_URL=/avatars/AvatarSample_E.web.vrm`.
- Rủi ro còn lại: `EXT_texture_webp` là phần mở rộng bắt buộc nên viewer VRM khác có thể không mở
  được bản `.web.vrm`; bản gốc vẫn dùng được cho việc đó.
- Chưa đo: bản build (làm ở 4.6.3). Kết nối trực tiếp (không qua relay) có thể nhanh hơn.

### Kết quả bước 4.6.2 (preload)

Làm xong phần code, kiểm tra một ca trên iPhone bằng cảm nhận, chưa có số đo.

- Code: `apps/web/src/components/avatar/preload.ts` (`preloadAvatar()` gọi `useLoader.preload`, dùng
  chung `registerVrm` với `Avatar` để khoá cache khớp). `voice-screen.tsx` gọi khi vào màn hình: đang ở
  avatar thì ngay, đang ở quả cầu thì lúc rảnh (`requestIdleCallback`, Safari iOS dùng `setTimeout`
  1,5 giây). Bỏ qua khi không có WebGL, đang ở sprite, hoặc bật tiết kiệm dữ liệu (chỉ nhánh quả cầu).
- Đã kiểm tra: type-check, lint (không thêm cảnh báo), build, và bản build có chứa code preload.
- Đã thử trên iPhone (Safari, tab riêng tư, qua Tailscale, `vite preview`): vào bằng quả cầu, bấm
  chuyển sang avatar thì avatar hiện trong khoảng 1 giây (cảm nhận, không đo).
- Ca vào thẳng bằng avatar (Web Inspector từ Mac, iPhone, tab riêng tư, qua Tailscale, `vite preview`):
  **không đạt**. File `.vrm` chỉ bắt đầu tải sau khi các chunk three.js (`GLTFLoader`, `three.core`,
  `events`) tải xong. Nguyên nhân: `preload.ts` import `GLTFLoader`, `@react-three/fiber`,
  `three-vrm` nên `useLoader.preload` phải đợi các chunk đó, tức là tải model vẫn nối đuôi tải code.
  Số đo là quan sát bằng mắt trên waterfall, không có mili giây.
- Sửa lần 1 (sai): thêm `<link rel="preload" as="fetch" crossorigin>` viết cứng trong `index.html`,
  trỏ tới `Mocking_Spit_Strawberry.vrm` (mặc định của code). App thật dùng
  `AvatarSample_E.web.vrm` (đặt bằng `VITE_AVATAR_URL` trong `.env.local`), nên thẻ preload tải nhầm
  file 5,7 MB mà không ai dùng, còn model thật vẫn tải sau code. Lần đo "đạt" đó là nhìn nhầm file.
  Phát hiện khi Network có hai dòng `.vrm` khác tên.
- Sửa lần 2 (vẫn chưa đạt): thẻ `<link rel="preload">` do plugin chèn, lấy URL từ `VITE_AVATAR_URL`,
  đã trỏ đúng `AvatarSample_E.web.vrm`. Nhưng Network trên Safari vẫn có hai dòng `.vrm`, cả hai
  trạng thái 200, 1,57 MB (gzip): một dòng loại xhr (preload), một dòng loại tìm nạp (`GLTFLoader`).
  Tức là model tải hai lần đầy đủ. Server gửi `Cache-Control: no-cache` + `Vary: Origin`, và Safari
  không gộp request preload với `fetch` của `GLTFLoader` (có thể do `no-cache`, hoặc do hai request
  chạy chồng nhau khi bản preload chưa xong). Chưa xác định chính xác nguyên nhân nào.
- Sửa lần 3 (đạt): bỏ thẻ `<link>`. Plugin `preloadAvatarModel` trong `apps/web/vite.config.ts` chèn
  một script ở đầu `<head>` tự `fetch` model một lần, giữ Promise ở `window.__avatarModel`.
  `AvatarLoader` (kế thừa `GLTFLoader`, trong `preload.ts`) thấy URL khớp thì gọi `parse` trên dữ liệu
  đó thay vì `fetch` lại; bản tải sớm lỗi hoặc URL khác thì rơi về cách tải thường. `Avatar` và
  `preloadAvatar()` cùng dùng `AvatarLoader` nên khoá cache `useLoader` vẫn khớp. Không phụ thuộc
  header cache nên không cần chờ 4.6.4.
  Kết quả đo trên iPhone (cùng điều kiện): Network chỉ còn **một dòng** `.vrm`, avatar vẫn hiện.
  Quan sát bằng mắt, chưa có mili giây.
  Đánh đổi: script chạy cả khi người dùng ở quả cầu, sprite hay bật tiết kiệm dữ liệu, nên model vẫn
  tải cho cả những người không dùng avatar. Nếu tốn băng thông đáng kể thì thêm điều kiện (đọc
  `localStorage` và `navigator.connection` ngay trong script đó).
  Đổi `VITE_AVATAR_URL` không cần sửa tay vì plugin đọc cùng biến; chỉ `DEFAULT_AVATAR_URL` trong
  `vite.config.ts` phải khớp mặc định trong `vrm-frame.ts`.
- Ca lỗi (headless Chrome + `vite dev`, trang `/?avatar-expression`, chặn request bằng puppeteer):
  - Model thật: 1 request, có canvas, không lỗi.
  - 404 và mất mạng: 2 request (fetch sớm rồi tải lại), `LoadBoundary` bắt lỗi, canvas bị gỡ, trang không treo. Đạt.
  - Request đầu 500, request sau ổn: đường lùi chạy, avatar vẫn hiện. Đạt.
  - File hỏng (200 nhưng không phải VRM): **lỗi**. `AvatarLoader` gọi `parse` trong `.then` mà không
    `try/catch` (`GLTFLoader.load` gốc có), nên `onError` không chạy và Suspense treo mãi ở "Đang tải".
    Đã sửa bằng `try/catch` quanh `parse`; chạy lại thì canvas bị gỡ, trang không treo. Đạt.
  - Cả ca 404, mất mạng và file hỏng đều có `pageerror` trong dev; nhiều khả năng React dev ném lại lỗi
    đã được boundary bắt, chưa so với bản trước 4.6.2.
  - `voice-screen` khi avatar lỗi (trang `/`, `localStorage` đặt sẵn chế độ avatar, chặn `.vrm` bằng
    puppeteer, `vite dev`): 404 (2 request) và file hỏng (1 request) đều quay về quả cầu và hiện dòng
    "Không tải được avatar, đang dùng quả cầu."; không treo, nút đổi về nhãn "Dùng avatar". Đạt.
    Model thật: avatar hiện, không có thông báo lỗi.
  - Hạn chế: sau lỗi, bấm "Dùng avatar" để thử lại không tạo request mới, dòng báo lỗi hiện lại ngay.
    Có vẻ cache của `useLoader` giữ kết quả lỗi, nên phải tải lại trang mới tải lại model dù mạng đã ổn.
    Chưa xác nhận nguyên nhân; xem lại ở 4.6.4 (cache).
  - Chưa thử trên iPhone và khi đang trong cuộc gọi với bot.
- Đo thứ tự request (headless Chrome, `vite build` + `vite preview`, vào thẳng `/` ở chế độ avatar, tắt
  cache, CPU chậm 4 lần, giả lập mạng bằng CDP, các bản chạy xen kẽ, trung vị, ms). `base` = `6368e5e`
  (chưa có script `fetch` ở `<head>`), `head` = `ed255b0`. `vrmStart-jsLastEnd` âm nghĩa là `.vrm` bắt
  đầu trước khi JS cuối cùng tải xong.

  | Mạng | Bản | `.vrm` bắt đầu | JS cuối tải xong | `vrmStart-jsLastEnd` | Avatar hiện |
  |---|---|---|---|---|---|
  | 20 Mbps, 50 ms (7 lần) | base | 932 | 872 | +61 | 3228 |
  | | head | 279 | 1019 | −732 | 2827 |
  | 4 Mbps, 100 ms (5 lần) | base | 1816 | 1755 | +58 | 6799 |
  | | head | 144 | 2500 | −2357 | 6117 |
  | 1,5 Mbps, 150 ms (7 lần) | base | 3970 | 3908 | +58 | 14047 |
  | | head | 201 | 5826 | −5628 | 13465 |

  Kết luận: `.vrm` bắt đầu tải từ 144–279 ms thay vì đợi JS, và mỗi lần chỉ có 1 request `.vrm`. Avatar
  hiện sớm hơn khoảng 400 ms (20 Mbps), 680 ms (4 Mbps), 580 ms (1,5 Mbps), tức 4–12%. Cải thiện nhỏ vì
  model 4,47 MB chiếm gần hết thời gian ở mạng chậm, và tải song song làm JS tải xong muộn hơn (cùng giành
  băng thông). Giảm kích thước model (4.6.1) và bật nén khi phục vụ bản build (4.6.3) mới là phần lớn hơn.
  Giới hạn: giả lập trên máy tính, chưa phải iPhone; chưa tính độ lệch giữa các lần chạy.
- Chưa kiểm tra: nhánh tiết kiệm dữ liệu (Safari không có `navigator.connection`, nên chỉ thử được trên
  Chrome).
- Lưu ý khi đọc số đo: `vite preview` nén gzip file `.vrm` (4,47 MB còn khoảng 1,57 MB), còn Vite dev
  server ở 4.6.1 thì không nén, nên không so thẳng được với số cũ. Với bản WebP, gzip giảm đáng kể
  (khác với PNG gốc ở 4.6). Server phục vụ bản build thật (4.6.3) cần bật nén cho `.vrm`.
- Chưa có số "trước" và "sau" cùng điều kiện. Muốn có thì thêm lớp phủ thời gian tạm hoặc dùng Web
  Inspector từ Mac, rồi đo cả hai kiểu có và không gzip.

### Kết quả bước 4.6.3 (phục vụ bản build)

Chốt dùng `vite preview` (cổng 4173) để đo ở phase 5.6; chỉ phía FE, bot giữ nguyên. Caddy/nginx để
dành cho production. Không để bot tự phục vụ `dist` (trộn hai việc vào một tiến trình chỉ để đo).

- Hiện trạng HTTPS: `tailscale serve` (chỉ trong tailnet): 443 trỏ `127.0.0.1:5173` (Vite dev), 8443 trỏ
  `127.0.0.1:7860` (bot). Chưa đổi gì. Muốn đo bản build thì đổi 443 sang 4173:
  `tailscale serve --bg --https=443 http://127.0.0.1:4173`, đo xong đổi lại 5173.
- Lệnh: `cd apps/web && npm run build && npx vite preview --port 4173`.
- Đã kiểm tra trên máy này (curl vào 4173, không qua iPhone, bot tắt):
  - Build thành công; `dist/index.html` trỏ `AvatarSample_E.web.vrm` (đúng `VITE_AVATAR_URL` trong
    `.env.local`) và file có trong `dist/avatars`.
  - `vite preview` dùng lại `server.allowedHosts` và `server.proxy`, **không cần khối `preview`** trong
    `vite.config.ts`: Host `*.ts.net` được phép (200), host lạ bị chặn (403), `POST /start` trả 502 khi
    bot tắt (tức proxy đã chuyển tới cổng 7860).
  - `.vrm` được gzip khi tải bằng GET: 4,47 MB còn 1.567.679 byte. `Content-Type` của `.vrm` để trống
    và `Cache-Control: no-cache` (4.6.4 xử lý).
- Đã kiểm tra với bot thật (STT vLLM cổng 8000, TTS VieNeu cổng 8001, bot cổng 7860 chạy bằng
  `uv run bot.py -t webrtc`): `POST /start` qua 4173 trả 200 kèm `sessionId` và cấu hình ICE; `POST
  /api/offer` với body rỗng trả 422 do thiếu `sdp`, tức request đã tới bot. Qua HTTPS của `tailscale
  serve` (443 trỏ 4173): trang 200, `.vrm` tải về 1.567.679 byte, `/start` 200.
- Đã thử trên iPhone (Safari, qua `tailscale serve` HTTPS, 443 trỏ 4173): bản build mở được, avatar
  hiện, gọi bot được (mic, WebRTC qua proxy của `vite preview` hoạt động). Người dùng báo bằng mắt, chưa
  có số đo; chưa xem Network (số request `.vrm`) và chưa ghi nhận avatar mấp máy miệng khi bot nói.
- **Chưa kiểm tra:** số request `.vrm` trên Safari ở bản build; nén bằng brotli; đo thời gian tải
  (thuộc 4.6.4 và phase 5.6).
- Sau khi đo xong cần đổi lại `tailscale serve` cổng 443 về 5173 nếu quay lại dùng dev server.
- Checklist khi lên production (Caddy/nginx thay `vite preview`):
  - Phục vụ `apps/web/dist`; proxy `/start`, `/sessions`, `/api/offer` sang bot (cấu hình trong
    `vite.config.ts` không còn tác dụng), địa chỉ bot theo môi trường thật.
  - Bật gzip/brotli cho `.vrm` và đặt `Content-Type` cho nó.
  - Đặt `Cache-Control` cho `.vrm` (4.6.4); bắt buộc HTTPS cho mic (Caddy tự cấp chứng chỉ).
  - Build với đúng `VITE_AVATAR_URL` (nhúng lúc build, quên thì tải nhầm model mặc định).
  - `allowedHosts` là cơ chế riêng của Vite, không dùng nữa.

### Kết quả bước 4.6.4 (cache file model, làm một phần, đã có một ca đo trên iPhone)

Đo bằng Chrome headless trên máy này (CDP, `vite build` + `vite preview` cổng 4173, trang
`/?avatar-expression`, mở 3 lần liên tiếp trong cùng một profile để cache HTTP được giữ). **Bảng này chỉ là
Chrome; số trên Safari iPhone ghi ở bên dưới, WKWebView chưa đo.** Số liệu là localhost, không qua mạng thật, chỉ dùng để so
cách đặt header, không dùng làm thời gian tải.

| Cách đặt `Cache-Control` cho `.vrm` | Lần 1 | Lần 2 và 3 |
|---|---|---|
| `no-cache` (trước khi sửa, 4.6.4.0) | tải 1.569.054 byte, 363 ms | vẫn gửi request kiểm tra lại, body 127 byte, 11 đến 16 ms |
| `public, max-age=3600` (tên chưa hash) | tải 1.569.066 byte, 336 ms | lấy từ cache đĩa, 0 byte, 13 đến 16 ms |
| `public, max-age=31536000, immutable` (tên có hash) | tải 1.569.081 byte, 400 ms | lấy từ cache đĩa, 0 byte, 12 đến 13 ms |

Cả ba bản đều chỉ có 1 request `.vrm` mỗi lần mở. Với `no-cache`, mỗi lần mở vẫn tốn một vòng round-trip
tới server (nhỏ trên localhost, nhưng qua Tailscale hay mạng di động thì có thể thấy được); `max-age`
và `immutable` bỏ hẳn vòng đó.

- 4.6.4.1: `apps/web/vite.config.ts` có plugin `vrmCacheControl` (chỉ cho `vite preview`). Tên có hash
  (`*.<8 ký tự hex>.vrm`) nhận `immutable`; tên chưa hash nhận `max-age=3600`, nên đổi model mà quên hash
  không bị giữ bản cũ cả năm. HTML vẫn `no-cache`.
- 4.6.4.2: hash thủ công bằng `apps/web/tools/hash-avatar.mjs`:
  `node tools/hash-avatar.mjs public/avatars/AvatarSample_E.web.vrm` sao chép (không ghi đè) sang
  `AvatarSample_E.web.<hash>.vrm` và in giá trị `VITE_AVATAR_URL`; `node tools/hash-avatar.mjs --check`
  kiểm tra `VITE_AVATAR_URL` trong `.env.local` có đúng hash của nội dung không. Hiện
  `.env.local` đặt `/avatars/AvatarSample_E.web.f17b1b4a.vrm` (file `.vrm` và `.env.local` đều bị
  `.gitignore`, nên chỉ có trên máy này). Chưa gắn `--check` vào bước build nào, nên vẫn dễ quên.
- 4.6.4.3: hoãn phần WKWebView. `apps/mobile` hiện là app Expo/React Native, chỉ có `android/`, không có
  `ios/` và chưa có `react-native-webview`; màn hình WebView là bước 5.2. Đo WKWebView sau khi có nó.
  Phần Safari iPhone ở tab thường vẫn cần đo.
- Đã thử trên Safari iPhone (tab thường, Web Inspector từ Mac, qua `tailscale serve` HTTPS, bản build với
  file có hash): sau khi nhập lại địa chỉ, dòng `.vrm` mất **4,89 ms**, nên model nhiều khả năng lấy từ
  cache. Chưa ghi lại nhãn nguồn (Memory/Disk Cache) và kích thước truyền, nên đây là suy ra từ thời gian;
  chưa có số cho lần 3, chưa thử sau khi đóng hẳn Safari hay sau một thời gian dài (iOS có thể xoá cache mà
  không báo).
- Chưa làm: đo lại hạn chế "bấm Dùng avatar để thử lại
  không tạo request mới" (xem 4.6.2), vẫn nghi cache của `useLoader` giữ kết quả lỗi.
- Production (Caddy/nginx): đặt `Cache-Control: public, max-age=31536000, immutable` cho `*.<hash>.vrm`,
  giữ ngắn hoặc `no-cache` cho tên không hash; build với `VITE_AVATAR_URL` trỏ file có hash.

## Kế hoạch bước 4.7 (tay tự nhiên hơn)

Hiện trạng (đọc từ code): tay chỉ được hạ một góc cố định `ARM_RAD` (58°) bằng cách đặt
`leftUpperArm.rotation.z` và `rightUpperArm.rotation.z` một lần để thoát tư thế chữ T
(`avatar-stage.tsx:248-249`, `sprite-capture.tsx:72-73`). Không có cẳng tay, khuỷu, bàn tay
hay vai, và tay không đổi theo trạng thái hay lời nói, nên trông cứng.

**Chọn hướng A (viết bằng code)**, vì nhẹ, không thêm file clip hay phụ thuộc, hợp với bậc nhẹ,
và cùng nhóm với mục "chuyển động nhàn rỗi" đang chưa làm. Sửa ở web nên mobile (phase 5)
hưởng luôn qua WebView.

| # | Việc | Ghi chú |
|---|---|---|
| 4.7.0 | Kiểm tra model có đủ bone `leftLowerArm`, `rightLowerArm`, `leftHand`, `rightHand`, `leftShoulder`, `rightShoulder` | **Đã kiểm tra** (2026-11-12, đọc JSON trong file): xem "Phát hiện khi đọc code" bên dưới |
| 4.7.0.1 | Tách đoạn đặt tư thế tay thành một hàm dùng chung (ví dụ `applyArmPose` trong `vrm-frame.ts`) cho `avatar-stage.tsx` và `sprite-capture.tsx`; thêm trường tay vào `AvatarPose` | Hiện hai nơi chép tay cùng đoạn `ARM_RAD`, thêm vai/khuỷu/bàn tay vào cả hai sẽ lệch nhau |
| 4.7.0.2 | Trang debug (ví dụ `/?avatar-pose`) có thanh trượt cho từng góc, và xác định trục xoay của khuỷu/bàn tay/vai trong không gian normalized của VRM 0.x (kể cả thứ tự Euler) | Để "chỉnh bằng mắt" ở 4.7.1 không phải sửa code rồi nạp lại; trục xoay chưa ai thử |
| 4.7.1 | Tư thế nghỉ: hạ tay khỏi chữ T bằng cả vai và cánh tay, gập nhẹ khuỷu, bàn tay thả lỏng | Thay cho một góc `ARM_RAD` duy nhất. Giá trị chỉnh bằng mắt |
| 4.7.1.1 | Bàn tay cong nhẹ: thêm bộ góc cong cố định cho các bone ngón vào `REST_ARM` | Làm theo điều kiện ở câu 1 (ngón duỗi trông cứng, đã được xác nhận khi xem 4.7.1). Cần đo trục ngón trên các model có ngón, thêm thanh trượt ngón vào trang debug, chỉnh bằng mắt; `chibi03` thiếu bone ngón thì bỏ qua; đo lại fps bằng `?avatar-fps` |
| 4.7.2 | Nhịp thở: vai nhún nhẹ, tay đung đưa rất nhỏ theo nhịp | Dùng chung bộ định thời với chuyển động nhàn rỗi |
| 4.7.3 | Theo trạng thái: nói thì tay cử động nhẹ theo mức miệng, nghĩ thì nâng tay hơi gập, nghe thì tay yên | Trạng thái lấy từ `use-avatar-state.ts`, chuyển mượt bằng `damp` sẵn có |
| 4.7.4 | Cập nhật khung camera và chụp lại sprite | Tư thế tay đổi thì `vrm-frame.ts` (bề ngang vai và tay) phải kiểm tra lại, và 16 ảnh sprite phải chụp lại bằng `node tools/capture-sprites.mjs` để khớp bản 3D |

**Xong khi:** bản 3D có tư thế nghỉ tự nhiên và tay chuyển động nhẹ theo trạng thái mà không
tốn rõ rệt fps ở bậc nhẹ; khung camera không cắt tay; sprite khớp tư thế mới.

### Phát hiện khi đọc code (2026-11-12)

Đọc `avatar-stage.tsx`, `use-avatar-state.ts`, `vrm-frame.ts`, `sprite-capture.tsx` và JSON nhúng trong các file `.vrm`. **Chưa chạy thử gì.**

- **Bone (4.7.0):** cả 5 model trong `public/avatars` (`AvatarSample_D`, `AvatarSample_E` gốc và bản web, `Mocking_Spit_Strawberry`, `chibi03`) là VRM 0.x và có đủ `leftShoulder`, `rightShoulder`, `leftUpperArm`, `leftLowerArm`, `leftHand` (và bên phải), `upperChest`, `chest`, `spine`, `neck`. `chibi03` chỉ có 28 bone, ~6 bone ngón (các model khác 30 bone ngón), nên nếu bàn tay thả lỏng dùng ngón thì `chibi03` không chạy được. Khi thiếu bone, `getNormalizedBoneNode` trả `null`, code phải bỏ qua bone đó.
- **Tay hiện không có dữ liệu tư thế:** `AvatarPose` không có trường nào cho tay; `rotation.z` của cánh tay được ghi đè tuyệt đối mỗi khung (không damp). Cần thêm trường vào `AVATAR_POSES` và `EXPRESSIONS`, và damp để chuyển mượt giữa trạng thái (như cách đầu đang làm).
- **Trục xoay chưa biết:** hiện chỉ đặt `rotation.z`. Khuỷu và bàn tay xoay quanh trục nào, thứ tự Euler mặc định XYZ ảnh hưởng ra sao, đều chưa thử (4.7.0.2).
- **Mức miệng chỉ được tính ở cuối `useFrame`**, trong khối `if (em)`. Muốn tay theo mức miệng (4.7.3) phải tính sớm hơn và làm mượt.
- **Sprite là ảnh tĩnh:** `applyShot` chụp cả 16 ảnh với tư thế `speaking`, không có chuyển động. Tay theo trạng thái (nâng tay khi nghĩ) không xuất hiện ở bậc sprite nếu không chụp riêng.
- **Va chạm:** 58° hiện tại có thể được chọn để tay không xuyên thân. Hạ tay sát hơn có thể xuyên thân hoặc làm spring bones của tay áo xử lý khác; chỉ nhìn thẳng từ trước thì khó thấy. Cần kiểm tra ở nhiều biểu cảm.
- **Khung camera:** `frameUpperBody` lấy bề ngang theo khoảng cách hai vai × `ARM_ROOM` (4), nên đổi khuỷu hay bàn tay không làm số này đổi. Khuỷu mở ra hoặc tay nâng lên có thể vượt khung hẹp (điện thoại dọc); phải xem ở cả tỉ lệ dọc và ngang.
- **Nhịp thở đã làm tay di chuyển:** `chest.rotation.x` xoay theo nhịp thở và tay là con của ngực nên tay đã đung đưa theo. 4.7.2 (thở bằng bone) và 4.8.3 (thở bằng CSS cho cả khung) làm cùng một việc theo hai cách.
- **Chi tiết:** chuyển động tay cần nhân hệ số `k` khi tắt mic như các chuyển động khác; `idle` và `connecting` cũng cần quy định tư thế tay.
- **Mốc fps:** "không tốn rõ rệt fps ở bậc nhẹ" cần một con số. Đề xuất so bằng `?avatar-fps` ở bậc nhẹ trước và sau khi sửa, ghi vào mục kết quả.

### Điểm cần quyết trước khi làm 4.7.1 trở đi (đã chốt cả 5 câu, 2026-11-12)

1. ~~**Ngón tay**~~ **Đã chốt (2026-11-12):** làm cổ tay trước (`leftHand`, `rightHand`), ngón tính sau. Chỉ thêm một bộ góc cong ngón cố định nếu trang debug (4.7.0.2) cho thấy bàn tay nằm trong khung và ngón duỗi trông cứng; `chibi03` thiếu bone ngón nên sẽ bỏ qua.
2. ~~**Sprite**~~ **Đã chốt (2026-11-12):** cách A, cả 16 ảnh dùng một tư thế nghỉ chung. So lại với cách B (3 ảnh `thinking` có tay nâng) sau khi xong 4.7.1 và có trang debug: chụp thử tạm, không ghi đè bộ ảnh hiện có, rồi so bằng mắt. Lưu ý nếu làm B: sprite dùng ảnh `thinking` cả khi bot nói với thẻ biểu cảm `thinking`, còn bản 3D chỉ nâng tay ở trạng thái `thinking`, nên sẽ lệch nhau.
3. ~~**"Nghĩ" ở 4.7.3**~~ **Đã chốt (2026-11-12):** phương án 1, chỉ trạng thái `thinking` nâng tay (thêm trường tay vào `AVATAR_POSES.thinking`, không đụng `EXPRESSIONS`). Khi bot nói với thẻ biểu cảm `thinking`, tay vẫn theo lời nói. Nếu sau khi xem trên trang debug thấy cứng thì nâng lên phương án 3 (thẻ `thinking` lúc nói nâng khoảng 40%).
4. ~~**Nhịp thở**~~ **Đã chốt (2026-11-12):** phương án 1, giữ `chest.rotation.x` hiện tại và thêm vai (`leftShoulder`, `rightShoulder`) nhún nhẹ bằng bone, dùng chung `pose.breath`. Thở bằng CSS cho cả khung (4.8.3) để quyết sau, dựa trên số đo ở 4.8.0; chỉ đáng làm nếu muốn bậc sprite cũng có chuyển động thở.
5. ~~**Tay theo mức miệng**~~ **Đã chốt (2026-11-12):** phương án 2. Lấy mức mở miệng (tổng hoặc max các viseme), làm mượt bằng `damp` chậm hơn miệng (khoảng 3 đến 4), rồi cho khuỷu và cổ tay nhích lên vài độ theo mức đó; không động cánh tay trên (dễ xuyên thân). Phải đưa phép tính miệng lên trước phần tay trong `useFrame` và nhân hệ số `k` khi tắt mic. Giá trị khởi đầu do tôi đặt, chỉnh bằng thanh trượt trên trang debug (4.7.0.2). Phương án 3 (cử chỉ theo nhịp nhấn) để dành nếu sau đó thấy tay còn đơn điệu.

### Kết quả bước 4.7.0.2 (trang debug và trục xoay)

Trang `/?avatar-pose` (`components/avatar/pose-test.tsx`, đăng ký ở `main.tsx`): ba thanh trượt x/y/z (độ) cho vai, cánh tay trên, khuỷu và cổ tay; ô "Đối xứng bên phải", ô "Hiện trục" (AxesHelper gắn vào bone), chọn thứ tự Euler, ba góc nhìn (front/side/top) và OrbitControls. Ô cuối panel hiện chuỗi URL của tư thế hiện tại để dán lại. Tham số URL: `shoulder`, `upper`, `lower`, `hand` (dạng `x,y,z`), `order`, `mirror=0`, `axes=1`, `view`, `cam`, `target`. Trang đặt thẳng `rotation` của bone, không qua `applyArmPose`.

Trục xoay **đo bằng số** (không chỉ nhìn): trên `AvatarSample_E.web.vrm`, tay hạ 58°, đặt +60° quanh từng trục rồi tính hướng từ bone đến bone con trong toạ độ thế giới. Mặt trước của model là +z (camera ở +z thấy mặt), bên trái của model ở +x. Thứ tự Euler là XYZ, mỗi lần chỉ xoay một trục.

| Trục | Ý nghĩa (bên trái; bên phải dùng cùng giá trị khi bật "Đối xứng") | Kết quả đo |
|---|---|---|
| x | Xoay dọc theo bone (vặn cẳng tay hoặc cổ tay), **không gập** | Hướng bone con gần như không đổi (cẳng tay (0,53; -0,85; 0,08) thành (0,59; -0,81; 0,04)) |
| y | Vung theo chiều trước/sau. **+y là ra sau, −y là ra trước** | Cẳng tay +60° thành (0,30; -0,48; **-0,82**) |
| z | Vung trong mặt phẳng nhìn từ trước. Cánh tay trên: +z hạ xuống. Khuỷu và cổ tay: +z đưa vào phía thân. Vai: +z hạ vai, −z nhún lên | Cẳng tay +60° thành (-0,47; -0,88; 0,08) |

Hệ quả cho 4.7.1 đến 4.7.3:
- **Gập khuỷu về phía trước là `lower.y` âm**, không phải `x` hay `z`. Cổ tay gập về phía trước cũng là `hand.y` âm.
- Cách đối xứng "đảo dấu y và z bên phải, giữ x" (đang dùng cho `ARM_RAD`) đã được xác nhận: bên phải ra cùng hướng trước/sau và cùng độ hạ như bên trái.
- Nâng cẳng tay lên (tay nghĩ) là `lower.y` âm lớn hơn; đưa tay vào gần thân là `lower.z` dương.
- Nhún vai lên là `shoulder.z` âm; nhờ đối xứng nên cả hai vai cùng nhún.

**Các model khác (đã đo 2026-11-12, `?model=/avatars/X.vrm`, cùng phép đo như trên):** `AvatarSample_E.web`, `AvatarSample_D`, `Mocking_Spit_Strawberry` và `chibi03` cho cùng dấu và cùng ý nghĩa của ba trục (x vặn, +y ra sau, +z của khuỷu đưa vào thân). Vậy bảng trục dùng chung được. Hai chỗ lệch nhỏ:
- Hướng nghỉ của cánh tay trên khác nhau vài độ: với cùng `upper.z = 58°`, cánh tay lệch khỏi phương thẳng đứng khoảng 29° (`AvatarSample_E`, `D`), 37° (`Mocking_Spit_Strawberry`), 24° (`chibi03`). Giá trị chỉnh trên `AvatarSample_E` sẽ hơi lệch trên model khác; chấp nhận được, hoặc bù theo model nếu muốn.
- `chibi03` không có bone ngón nên không đo được trục của cổ tay (`hand`); bone `leftHand` vẫn có.

**Thứ tự Euler (đo cùng ngày, 4 tư thế × 5 thứ tự so với `XYZ`, độ lệch vị trí cổ tay tính bằng cm trên `AvatarSample_E`):**
- Tư thế chỉ xoay **một trục cho mỗi bone** (ví dụ `upper.z`, `lower.y`, `hand.y`): mọi thứ tự cho kết quả giống hệt (0 cm).
- Khi một bone xoay **từ hai trục trở lên** (ví dụ cánh tay trên `y` và `z`): thứ tự có ảnh hưởng, lệch từ 2,5 đến 15 cm ở cổ tay so với `XYZ` (cánh tay dài khoảng 60 cm), tuỳ thứ tự và tư thế. `YXZ` và `YZX` gần `XYZ` hơn `ZXY` và `ZYX`, nhưng không trùng.
- Kết luận: **giữ `XYZ` (mặc định của three, đang dùng cho `ARM_RAD`)** và tránh để một bone xoay nhiều trục cùng lúc khi không cần. Giá trị chỉnh trên trang debug phụ thuộc thứ tự Euler đang chọn, nên đổi thứ tự sau khi chỉnh sẽ làm tư thế lệch; ghi thứ tự cùng giá trị.

Chưa kiểm tra:
- Hình dạng có xuyên thân hay không ở các tư thế thật (mới chụp thử vài ảnh để xem trang chạy); nên làm sau 4.7.1, khi đã có tư thế nghỉ.
- Chưa kiểm tra trên điện thoại.

### Kết quả bước 4.7.1 (tư thế nghỉ)

`REST_ARM` (`vrm-frame.ts`) dùng chung cho mọi trạng thái, avatar 3D và `sprite-capture.tsx`. `ArmPose` đổi từ một trường `upper` sang `shoulderZ`, `upperZ`, `lowerY`, `lowerZ`, `handY`; `applyArmPose` đặt vai, cánh tay trên, khuỷu và cổ tay, bên phải đảo dấu y và z. Giá trị cuối (độ), chỉnh sau khi xem trên trang debug:

| Bone | Góc |
|---|---|
| Vai | `z` 6 |
| Cánh tay trên | `z` 55 (tổng với vai 61, hơn 58 cũ) |
| Khuỷu | `y` -8, `z` 3 |
| Cổ tay | `y` -3 |

Giá trị đầu tiên (khuỷu `y` -18, cổ tay `y` -8) bị thấy là đưa tay ra trước quá nhiều cho tư thế nghỉ nên đã giảm. Xem trên trang debug (`/?avatar-pose`, thứ tự Euler `XYZ`): không thấy xuyên thân, đánh giá ổn.

Chưa kiểm tra:
- Xuyên thân ở các biểu cảm khác nhau trên bản 3D thật.
- Điện thoại.
- Model khác ngoài lần xem trên trang debug (hướng nghỉ cánh tay trên lệch vài độ giữa các model).
- fps (mốc `?avatar-fps` ở bậc nhẹ, trước và sau).
- Ngón vẫn thẳng, xử lý ở 4.7.1.1. Sprite chưa chụp lại (4.7.4).

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
