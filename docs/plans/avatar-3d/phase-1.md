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
    arm-pose.ts                 `ArmPose`, `REST_ARM`, `ARM_RAD`, không import three (xem mục 1.4 bên dưới)
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
- ~~Chưa chốt model dùng lâu dài~~ Đã chốt `AvatarSample_E` (xem mục "Cập nhật sau phase 4"). Ghi chú
  "Mocking Spit luôn há miệng rộng nên lip-sync khó thấy" là về Mocking Spit; chưa có ghi chép nào về độ rõ
  của lip-sync trên `AvatarSample_E` (phase 2.4 không nói đã thử với model nào, và nhiều khả năng là Mocking
  Spit, vốn là mặc định lúc đó).
- ~~`avatar-test.tsx` còn lặp ~40 dòng chuẩn bị model với `avatar-stage`; chưa gộp.~~ Đã gộp phần lớn (xem mục "Code lặp" bên dưới).

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
- **Tư thế (1.2):** góc tay đã được chỉnh ở 4.7. Góc đầu (nghiêng, gật, nhìn) trong `AVATAR_POSES` không đổi từ commit đầu `c500a7b` (2026-10-29), tức chưa chỉnh riêng sau phase 1. Tuy vậy các tư thế đã chạy trong cuộc gọi thật (phase 3 ghi avatar "nghiêng đầu nhìn lên" khi bot gắn thẻ `thinking`) và không có phàn nàn nào về góc được ghi lại. Câu "chưa chỉnh với bot thật" ở trên là của lúc viết 1.2; mục tích "đã thử với bot thật" ở cuối file là kết quả sau đó, nên hai câu không thật sự mâu thuẫn. Soát ngày 2026-11-15: biên độ góc đầu nhỏ (nghiêng 6° ở `listening`, nghiêng 8° và ngẩng 5° ở `thinking`, gật khoảng 3° ở `connecting` và 1,4° ở `speaking`), mọi góc đi qua `damp` theo `dt`, ảnh tĩnh của `speaking`, `listening`, `thinking` không thấy xuyên thân, cắt khung hay méo mặt (trạng thái `idle` chưa chụp được vì trang thử không có). Độ tự nhiên khi chuyển động liên tục lúc gọi bot thật: người dùng xem trên iPhone ngày 2026-11-16 và đánh giá "tạm ổn" (nhận xét chung, không ghi riêng từng trạng thái; `idle` vẫn chưa chụp ảnh tĩnh).
- **Model:** model dùng lâu dài là `AvatarSample_E` (bản chạy qua `apps/web/.env.local`: `VITE_AVATAR_URL=/avatars/AvatarSample_E.web.f17b1b4a.vrm`). Mặc định trong code (`vrm-frame.ts`, `vite.config.ts`, `avatar-test.tsx`) đã đổi từ `Mocking_Spit_Strawberry.vrm` sang `/avatars/AvatarSample_E.web.vrm` để khỏi tải nhầm model khi thiếu `.env.local`. Dòng ở 1.1 ghi mặc định Mocking Spit là của lúc viết phase 1. Các file `.vrm` không nằm trong repo (`public/avatars/*.vrm` bị gitignore); sprite `.webp` thì có trong repo.
- **Ba bậc thay vì hai (1.3):** nút chuyển vẫn chỉ đổi quả cầu và avatar, nhưng avatar nay có bậc đầy đủ, bậc nhẹ và sprite 2D. Sprite chạy khi không có WebGL, hoặc khi bậc nhẹ vẫn tụt fps (4.3, 4.5).
- **Nạp lazy (1.4):** `SpriteStage` cũng nạp lazy. Model được tải sớm bằng một `fetch` chèn vào `<head>` từ `vite.config.ts`, và `preload.ts` dùng lại kết quả (4.6.2). Đó không phải `<link rel="preload">` cho model.
  - **Đã từng hồi quy rồi đã sửa (kiểm tra 2026-11-15 bằng cách build lại từng commit):** ghi chép 1.4 ở trên đúng lúc viết (bản build ở `55a5207`: `WebGLRenderer` chỉ ở `GLTFLoader-*.js`, `index-*.js` không import tĩnh chunk nào, `index.html` không `modulepreload`). Từ `3201fc8` (4.7.0.1, 2026-11-12), `use-avatar-state.ts` import giá trị (`ARM_RAD`, sau là `REST_ARM`) từ `vrm-frame.ts`, mà file này import `three` và `@pixiv/three-vrm`; `voice-screen.tsx` import `use-avatar-state.ts` không lazy, nên `index-*.js` import tĩnh chunk `three-vrm.module-*.js` (khoảng 884 KB) và `index.html` có `modulepreload` trỏ tới nó, tức người chỉ dùng quả cầu cũng tải three.js.
  - **Cách sửa:** tách `ArmPose`, `REST_ARM`, `ARM_RAD` sang `arm-pose.ts` (không import three, góc tính bằng cùng công thức với `MathUtils.degToRad` nên giá trị giống hệt từng bit), `vrm-frame.ts` re-export các tên đó, `use-avatar-state.ts` import từ `arm-pose.ts`. Build thử sau khi sửa: `index-*.js` chỉ import `rolldown-runtime`, `modulepreload` chỉ còn `rolldown-runtime`, `WebGLRenderer` về lại `GLTFLoader-*.js` và `three.core-*.js`. Tên chunk đổi theo cấu trúc import (`GLTFLoader` → `three.core` + `GLTFLoader` → `three-vrm.module` khi hồi quy), không phải lỗi.
  - **Cần giữ:** đừng để file nào nằm trong bundle chính (như `voice-screen.tsx` và những gì nó import không lazy) import giá trị từ `vrm-frame.ts` hay `three`. Đã chạy lại trên iPhone sau khi tách (xem mục kiểm tra bên dưới).
- **fps khi gọi bot (đo 2026-11-16):** iPhone 15 Pro Max, Safari, bản build qua `tailscale serve` HTTPS, đang gọi bot thật, bậc đầy đủ, `?avatar-fps&tier=full&fps=0` (không giới hạn fps): khoảng 59 đến 60 fps. Đó là trần màn hình, nên chỉ cho biết **không tụt khi WebRTC và audio chạy song song**, không cho biết mức dư. Ở chế độ mặc định (không `?fps=0`) cùng máy hiện 20 fps, tức bậc nhẹ (giới hạn 20 fps), cả sau khi xoá dữ liệu trang (đo 2026-11-16). Gọi bot không làm máy tụt (59 đến 60 fps khi bỏ giới hạn), nên nguyên nhân nhiều khả năng là `pickInitialTier` trong `quality.ts`: chọn bậc nhẹ khi `hardwareConcurrency <= 4` hoặc `deviceMemory <= 4`, mà Safari không có `deviceMemory` (mặc định 4 trong code) và thường báo ít lõi, nên iPhone luôn vào bậc nhẹ. Đây là suy luận từ code, chưa đọc giá trị `hardwareConcurrency` thật trên iPhone. Nhiệt và pin vẫn chưa đo. Dòng "chưa đo fps" ở mục "Chưa kiểm tra" nay đã có số liệu ở đây.
- **Kiểm tra sau khi tách `arm-pose.ts` (2026-11-16):** build qua; `index-*.js` chỉ import tĩnh `rolldown-runtime`, không có `WebGLRenderer` (chỉ ở `GLTFLoader-*.js` và `three.core-*.js`), `modulepreload` trong `index.html` chỉ có `rolldown-runtime`. Trên iPhone (Safari qua `tailscale serve`): avatar hiện, nút chuyển quả cầu / avatar hoạt động, không có màn hình đen; gọi bot thật ổn.
- **Lip-sync trên `AvatarSample_E`:** người dùng xem trên iPhone ngày 2026-11-16 khi gọi bot thật: lip-sync rõ, không quá lệch (nhận xét bằng mắt, chưa đo độ trễ bằng số). **Chốt (2026-11-18):** chấp nhận bằng mắt, không đo bằng số. Phần phần mềm gần như chắc chắn nhỏ (`AnalyserNode` đọc đúng track đang phát, `ATTACK = 35`); phần khó đoán là độ trễ đầu ra âm thanh của máy, nhất là tai nghe Bluetooth, chỉ đo được bằng quay chậm từ thiết bị thứ hai. Nếu sau này thấy miệng lệch ở một thiết bị cụ thể thì mới đo lại; hướng sửa là thêm độ trễ nhỏ cho miệng (`phase-2.md`, 2.4). Dòng ghi chú ở mục "Chưa kiểm tra" về việc chưa có ghi chép cho model này nay đã có.
- **Ảnh tĩnh `idle` (2026-11-17):** chụp bằng Chrome headless (SwiftShader) trên bản build với `VITE_DEFAULT_VISUAL=avatar`, khung 390×780, màn hình chờ trước khi gọi, model `AvatarSample_E`. Khung đủ nửa người trên, tay hạ không xuyên thân, mặt không méo. Chỉ là ảnh tĩnh, chưa nói gì về chuyển động.
- **Đọc lại `pickInitialTier` (2026-11-17):** `memory = deviceMemory ?? 4` rồi `cores <= 4 || memory <= 4`, nên khi trình duyệt không có `deviceMemory` (Safari) thì điều kiện luôn đúng và luôn vào bậc nhẹ, bất kể số lõi. Vậy suy luận ở mục fps không còn phụ thuộc vào `hardwareConcurrency` thật. Overlay `?avatar-fps` nay in thêm `cores` và `mem`. **Đo trên iPhone 15 Pro Max (Safari, 2026-11-17):** `cores 4`, `mem n/a`, vào bậc nhẹ (`light 10/10 fps` lúc chờ, 20 fps khi gọi). Vậy iPhone vào bậc nhẹ vì hai lý do độc lập (`cores <= 4` và `deviceMemory` thiếu), dù chạy được 59 đến 60 fps ở bậc đầy đủ. **Đã sửa `pickInitialTier` (2026-11-18):** chỉ tính `deviceMemory` khi trình duyệt có báo, và ngưỡng lõi hạ từ `<= 4` xuống `<= 2` (`weak = (memory !== undefined && memory <= 4) || cores <= 2`); máy yếu hơn vẫn có `downgrade` của `PerformanceMonitor` (hạ khi fps dưới 70% giới hạn của bậc, chờ ổn định 4 giây trước khi đo). Đo lại trên iPhone 15 Pro Max (Safari, `?avatar-fps`, không `?tier=`): 15 fps lúc chờ, 30 fps khi gọi, đúng với bậc `full` (người dùng đọc từ overlay). Chưa ghi nhận máy có tự hạ về `light` trong cuộc gọi dài hay không; nhiệt và pin vẫn chưa đo. Rủi ro đã biết: máy 3 đến 4 lõi không có `deviceMemory` mà yếu sẽ giật một lúc trước khi được hạ bậc.
- **Màn hình chờ `idle` (2026-11-17, iPhone, bậc nhẹ 10 fps):** người dùng xem bằng mắt: ngực và vai nhấp nhô nhẹ, chớp mắt ngẫu nhiên, mặt thư giãn, tay nghỉ, không gật hay lắc người. Chuyển động tương đối êm, khựng nhẹ (hợp lý với 10 fps lúc chờ). Phát hiện lúc xem: `frame.pointer` của R3F giữ toạ độ lần chạm cuối, nên avatar nhìn cứng về đó mãi. Đã sửa: con trỏ đứng yên quá `POINTER_IDLE_S` (2 giây) thì `px`, `py` về 0 và đầu, mắt quay về giữa qua các `damp` sẵn có. Người dùng thử trên iPhone: đầu về giữa sau 2 giây. Hệ quả: giữ ngón tay đứng yên quá 2 giây cũng khiến avatar quay về giữa.
- **Code lặp (đã gộp một phần, 2026-11-16):** `avatar-test.tsx` nay dùng `AvatarLoader` + `registerVrm` (như `avatar-stage.tsx` và `pose-test.tsx`), `prepareVrm` và hàm mới `setupLookAt` trong `vrm-frame.ts` (cũng dùng ở `avatar-stage.tsx`); ba tệp bớt 32 dòng. **Còn lại, cố ý giữ riêng:** khối tính khung camera trong `avatar-test.tsx` (khung 95% chiều cao, không dùng `frameUpperBody`) và góc hạ tay cố định `?arm=`, vì gộp sẽ đổi khung hình của trang thử. Đã kiểm tra: `tsc -b`, build, bundle chính vẫn không có three; trang thử trên Chrome máy tính (người dùng): model hiện, đầu và mắt nhìn theo con trỏ, đổi biểu cảm được, `?model=` khác nạp được. `setupLookAt` ở `avatar-stage.tsx` đã xác nhận trên iPhone (2026-11-17, màn hình chờ, kéo ngón tay): đầu và tròng mắt đều dịch theo, đúng chiều. Điểm nhìn và tư thế khi gọi bot thật trên iPhone (2026-11-17, bản build qua `tailscale serve`): `connecting`, `listening`, `speaking` đúng như bảng `AVATAR_POSES`; `thinking` có đưa tay phải lên cằm và nghiêng đầu sang một bên sau khi người dùng nói xong (người dùng xem bằng mắt, không quay video, không ghi riêng hướng của mắt ở `thinking`).
- **`idle` ở bậc `full` (2026-11-18, iPhone 15 Pro Max, Safari, overlay `full 15/15 fps · cores 4 · mem n/a`):** viền ổn, ngực và vai nhấp nhô, đầu và mắt nhìn theo ngón tay, khung hình đủ nửa người trên. Tóc và váy trông đứng yên: model có spring bones thật (ngực, tay áo, váy, khoảng 17 nhóm tóc, đều `gravityPower` 0, `stiffiness` 0,25 đến 0,75) và `full` có chạy `vrm.update(dt)`, nhưng chúng chỉ động khi xương cha động, mà ở `idle` thân chỉ nhấp nhô 0,012 rad và không lắc, nên đứng yên là hợp lý. Chưa ghi nhận thử kéo ngón tay mạnh hay xem lúc `speaking` để thấy tóc bay, nên **spring bones chưa được xác nhận bằng mắt là có chạy**.
- **Lỗi viền chấm đứt ở nách (2026-11-18, chỉ bậc `full`):** dọc mép trong hai tay áo, chỗ tay áo ép sát thân váy, viền hiện thành chấm đứt quãng (ảnh chụp từ iPhone, cắt phóng to). Tắt outline bằng `?outline=0` thì hết, nên thủ phạm là outline, không phải nhún vai hay spring bones (bậc nhẹ không lỗi vì không có outline). Chỉ 4 vật liệu của `AvatarSample_E` có outline thật (`_OutlineWidthMode` 1, width 0,075): `Face_00_SKIN`, `Body_00_SKIN`, `Onepice_01_CLOTH` (váy và tay áo, hai mặt) và `Shoes_01_CLOTH`. Nghi: outline của váy tranh độ sâu với outline của da cánh tay nằm sát bên dưới (suy luận từ dữ liệu vật liệu, chưa tách riêng từng vật liệu để xác nhận).
  - **Cách sửa (hướng A):** trong `avatar-stage.tsx`, outline của vật liệu có tên khớp `/_CLOTH\b/` luôn ẩn (gồm váy, tay áo và **cả giày**, tác dụng phụ của việc nhận theo nhãn), outline mặt và da giữ. Người dùng thử trên iPhone: chấm đứt đã hết.
  - **Tham số chẩn đoán** (`quality.ts`, `outlineOverride`): `?outline=0` tắt hết, `?outline=1` bật hết kể cả vải; không có thì theo bậc. Chỉ để tách lỗi hình, không dùng thường ngày.
  - **Giới hạn:** quy tắc `_CLOTH` gắn với tên vật liệu; model có tên khác sẽ vẫn bật outline vải. Giày bị tắt outline chưa có ai xem riêng.
  - **Đối chiếu các model khác (2026-11-19, đọc `materialProperties` VRM 0.x trong file `.vrm`, không chạy trong trình duyệt):**
    - `AvatarSample_E`: outline ở Face, Body, Onepice, Shoes (width 0,075); quy tắc ẩn Onepice và Shoes.
    - `AvatarSample_D` (cùng họ, có trong `public/avatars/`): outline ở Face, Body, Tops, Accessory, Bottoms, Shoes; quy tắc ẩn cả 4 vật liệu vải. Chưa ai xem D trong avatar-stage.
    - `chibi03`: một vật liệu `Avatar03_Neutral_Mat` (outline bật, width 0,5), không có `_CLOTH` nên quy tắc không tác động. Lỗi nách cần hai vật liệu tranh độ sâu nên gần như không xảy ra theo cơ chế đã suy ra (suy luận, chưa xem bằng mắt).
    - `Mocking_Spit_Strawberry`: một vật liệu `mat_avatar01cute`, outline tắt (`mode 0`), quy tắc không có gì để làm.
    - Giày của `E`: khung camera là nửa người trên (`UPPER_BODY` 0,62) nên giày nhiều khả năng ngoài khung (suy luận từ số khung, chưa chụp). Xem được ở trang `avatar-test` (khung 95% chiều cao).
    - Chỉ cần xem bằng mắt khi thực sự dùng `D` hoặc `chibi03`.
- **Răng cưa nhẹ ở cằm và cổ tay (2026-11-18, `full`):** người dùng thấy sau khi sửa lỗi nách. Là outline da, mảnh, đúng chỗ da giáp vải. Nghi do `dpr` của `full` giới hạn 1,5 (`quality.ts`) trong khi iPhone có `dpr` thật 3 (suy luận từ cấu hình, chưa đo). **Chấp nhận, chưa sửa:** nâng `dpr` lên `[1, 2]` sẽ tăng số điểm ảnh khoảng 78% (4 so với 2,25), nên hoãn đến khi đo xong nhiệt và pin; nếu máy mát và fps còn dư thì đó là bước tiếp theo.
- **Spring bones xác nhận bằng số (2026-11-18, iPhone 15 Pro Max, bậc `full`):** overlay `?avatar-fps` có thêm dòng `springs <số khớp> · move <độ>°/khung` (`springStat` trong `avatar-stage.tsx`; `springs off` ở bậc nhẹ). `move` là góc đổi lớn nhất của một khớp giữa hai khung liên tiếp trong 1 giây gần nhất. Đo trên iPhone: **đứng yên 0,50°/khung, kéo ngón tay mạnh trên 10°/khung**, nên spring bones chạy thật ở `full`; tóc và váy nhìn như đứng yên lúc `idle` vì chuyển động nền chỉ cỡ 0,5° mỗi khung. Con số 0,50° lúc đứng yên nhiều khả năng do nhún vai theo nhịp thở (cỡ 4°, ở 15 fps mỗi khung đổi khoảng 0,3 đến 0,4°; suy luận, chưa kiểm tra bằng cách tắt nhún vai). Đã xác nhận bằng mắt ở mục kế tiếp (`?shake`).
  - **Bài học về cách đo:** lần đo đầu lấy độ lệch so với góc lúc nạp model và ra **50° lúc đứng yên**, không phản ánh chuyển động. Nguyên nhân nghi ngờ: lúc nạp tay còn dang chữ T, sau đó tay hạ xuống và collider của thân đẩy tay áo, váy đứng yên ở một góc lệch cố định (suy luận, chưa tìm ra khớp nào ra 50°). Đã đổi sang đo chuyển động giữa hai khung. Một giây đầu sau khi nạp model có thể cao vì các khớp còn ổn định.
- **Spring bones xác nhận bằng mắt (2026-11-19, iPhone 15 Pro Max, Safari, `?avatar-fps&shake`):** `?shake` (`avatar-stage.tsx`) lắc xương hips 1,5 giây rồi đứng yên 2,5 giây, lặp lại; chỉ để chẩn đoán, không ảnh hưởng khi không có tham số. Người dùng xem bằng mắt ở bậc `full`: tóc, tay áo và váy trễ theo thân khi lắc, váy là phần còn chuyển động cuối cùng khi thân đã dừng. Ở `?tier=light` (spring bones tắt) chúng cứng theo thân. Vậy spring bones chạy thật và nhìn thấy được. Chưa xem lúc `speaking` khi gọi bot thật, nơi biên độ nền nhỏ hơn nhiều (chỉ là chuyển động thở và sway nhẹ), nên tóc có thể lay rất nhẹ ở đó.
- **Hướng mắt ở `thinking` (2026-11-18, iPhone 15 Pro Max, Safari, trang `?avatar-expression` giữ trạng thái `thinking`, không thẻ biểu cảm):** người dùng xem bằng mắt: mắt nhìn lên và lệch sang một bên đúng như `AVATAR_POSES.thinking` (`gaze` `{ x: 0.5, y: 0.45 }`), tròng mắt dịch theo đúng chiều, hướng nhìn tự nhiên. Đó chỉ là trạng thái giữ cố định; chuyển tiếp thật được xem ở mục kế tiếp. Mục "hướng mắt ở `thinking` chưa ghi lại" đã đóng.
- **`thinking` vào và ra giữa cuộc gọi thật (2026-11-19, iPhone 15 Pro Max, Safari, bậc `full`, bot thật):** người dùng xem bằng mắt qua nhiều lượt nói rồi im chờ bot trả lời: tư thế vào `thinking` và ra sang `speaking` đều mượt, không thấy xuyên thân hay giật. Không quay video, không ghi riêng từng lượt; chưa thử lượt bot trả lời rất nhanh (`thinking` chỉ thoáng qua).
- **Tóc lúc `speaking` và góc đầu (2026-11-19, iPhone 15 Pro Max, Safari, bậc `full`, bot thật):** người dùng xem bằng mắt khi bot nói: tóc và váy ổn; góc đầu ở bốn trạng thái (`connecting`, `listening`, `thinking`, `speaking`) ổn, không cần chỉnh `AVATAR_POSES`. Nhận xét chung, không ghi riêng từng trạng thái, không đọc số `move` lúc `speaking`. Hai mục "tóc lúc `speaking` chưa xem" và "góc đầu chưa chỉnh riêng" đã đóng.
