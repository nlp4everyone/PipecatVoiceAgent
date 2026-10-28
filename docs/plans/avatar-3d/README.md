# Kế hoạch avatar 3D

Mục tiêu: thêm một nhân vật 3D kiểu anime/chibi (định dạng VRM) vào giao diện
chat giọng nói, bên cạnh quả cầu (orb) hiện có. Nhân vật mấp máy môi theo giọng
bot, đổi tư thế theo trạng thái hội thoại và biểu cảm theo ngữ cảnh. Không dùng
dịch vụ trả phí; vẫn chạy ổn trên máy cấu hình yếu.

Các giai đoạn:

| # | Tài liệu | Nội dung |
|---|---|---|
| 0 | [phase-0.md](phase-0.md) | Chọn model, dựng trang thử, đo hiệu năng ban đầu |
| 1 | [phase-1.md](phase-1.md) | Tích hợp vào `apps/web`, chuyển qua lại với quả cầu |
| 2 | [phase-2.md](phase-2.md) | Mấp máy môi theo giọng bot |
| 3 | [phase-3.md](phase-3.md) | Biểu cảm theo ngữ cảnh (cần sửa backend) |
| 4 | [phase-4.md](phase-4.md) | Hiệu năng và các bậc chất lượng cho máy yếu |
| 5 | [phase-5.md](phase-5.md) | App mobile qua WebView |

## Quyết định đã chốt

| Hạng mục | Lựa chọn |
|---|---|
| Phong cách | Anime/chibi, định dạng VRM, chỉ nửa người trên |
| Model ban đầu | VRM CC0 có sẵn (VRoid AvatarSample D hoặc E); thay model chibi riêng sau |
| Mục đích dùng | Cá nhân, nên giấy phép model thoải mái hơn, nhưng vẫn ghi lại giấy phép từng model |
| Web | React Three Fiber + `drei` + `@pixiv/three-vrm` + `@pixiv/three-vrm-animation`; ghim phiên bản chính xác, giữ lockfile |
| Mobile | WebView tải trang avatar của web; WebRTC vẫn ở native, mức âm gửi sang bằng `postMessage` |
| Lip-sync | Theo biên độ và dải tần âm thanh của bot (không phụ thuộc ngôn ngữ, hợp tiếng Việt) |
| Cảm xúc | LLM chèn thẻ `[happy]`…; processor Pipecat tách thẻ trước TTS và gửi qua RTVI |
| Chuyển động | Mixamo (retarget sang VRM) cộng idle viết bằng code |
| LLM | Giữ Groq free tier, Gemini dự phòng (cấu hình LLM dự phòng có sẵn) |
| STT / TTS | Giữ nguyên, tự host (`vllm_realtime`, `vieneu`) |
| Cấu trúc | Giữ nguyên quả cầu; thêm `components/avatar/` trong `apps/web`, nạp bằng `React.lazy`; chuyển qua lại bằng cài đặt, **không** hiển thị cả hai cùng lúc |
| Branch | `feat/avatar-3d`, tạo từ `feat/chatgpt-voice-client` (nhánh này chứa `apps/web`, `apps/mobile`; `main` thì không) |

## Vì sao VRM

VRM là file glTF cộng quy ước chung: xương người chuẩn, biểu cảm có tên chuẩn
(`aa/ih/ou/ee/oh`, `happy`, `blink`…), look-at, vật lý tóc/váy (spring bones) và
shader kiểu anime (MToon). Nhờ vậy lip-sync và cảm xúc chỉ là đặt giá trị 0–1
cho các tên chuẩn, và đổi nhân vật chỉ cần đổi file.

Hạn chế: có hai phiên bản (0.x và 1.0) khác nhau ở vài chi tiết; MToon có
outline vẽ mesh hai lần và spring bones tốn CPU, nên phải tối ưu cho máy yếu.

## Các bậc chất lượng

Chọn bậc theo khả năng máy, hạ bậc tự động khi fps rớt (chi tiết ở
[phase-4.md](phase-4.md)).

| Bậc | Cách render | Dành cho |
|---|---|---|
| 3 – Đầy đủ | VRM chibi, 30 fps, spring bones, biểu cảm đầy đủ | Máy khoẻ |
| 2 – Nhẹ | VRM low-poly (~15k tam giác), 20 fps, `dpr` = 1, texture 512, tắt physics | Máy trung bình |
| 1 – Dự phòng 2D | Sprite dựng từ Blender **hoặc** Live2D (chọn ở phase 4) | Máy rất yếu, WebGL lỗi |
| 0 – Quả cầu | `chat-orb` hiện có | Dự phòng cuối cùng |

## Ngân sách hiệu năng (mục tiêu, chưa đo)

- Bậc đầy đủ: 30 fps ổn định trên iPhone 15 Pro Max.
- Không nóng rõ rệt và pin không tụt bất thường sau 10 phút gọi.
- Đo trên thiết bị thật từ phase 0, kể cả một máy yếu nếu có. Số liệu ở đây là
  mục tiêu, không phải kết quả đo.

## Rủi ro và điều cần kiểm chứng

- Hiệu năng thực tế của VRM trong WebView trên máy yếu. Có báo cáo cho rằng
  three.js + VRM nặng và kém ổn định ở trường hợp tương tự; chưa xác minh.
- Chất lượng miệng với giọng VieNeu và tỉ lệ chibi (đầu to nên dễ lộ lỗi).
- Giấy phép của từng model được chọn.
- Chuỗi cung ứng npm: ghim phiên bản, giữ lockfile, kiểm tra trước khi cài.
- Bundle web phình do three.js; giảm bằng `React.lazy`.
- Backend có giới hạn số phiên đồng thời không (chưa kiểm tra).
- Font giao diện có hiển thị đủ dấu tiếng Việt không (chưa kiểm tra).

## Chưa quyết định

- Bậc 1 dùng sprite dựng từ Blender hay Live2D: chốt ở phase 4.
- Có dùng ánh xạ viseme theo chữ không: chỉ cân nhắc nếu TTS cho mốc thời gian
  theo từ và lip-sync theo biên độ chưa đủ đẹp.

## Phương án đã cân nhắc và không chọn

Babylon.js (VRM yếu hơn), Unity và Godot (nặng, tách khỏi codebase React),
render phía server rồi stream video (tốn GPU theo phiên, độ trễ cao), native
iOS thuần (chỉ một nền tảng), Rive/Live2D làm lõi (2D, cần nhân vật riêng).
Live2D và sprite vẫn là ứng viên cho bậc dự phòng.
