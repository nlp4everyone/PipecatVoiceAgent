# VoiceAgent

Trợ lý giọng nói **tiếng Việt**, hội thoại theo thời gian thực, xây trên
[Pipecat](https://docs.pipecat.ai). Người dùng nói qua trình duyệt (WebRTC) hoặc
phòng Daily; bot nghe, hiểu, trả lời bằng giọng nói — và có thể bị ngắt lời giữa
chừng như khi nói chuyện với người thật.

## Demo

https://github.com/user-attachments/assets/982dcfb9-4d5f-4bf3-9d4b-0b7697c82451

Không xem được video? Tải bản dự phòng: [docs/media/demo.mp4](docs/media/demo.mp4).

## Bot hoạt động thế nào?

```
 Mic ──► VAD ──► STT ──► LLM ──► TTS ──► Loa
       (có ai    (giọng   (nghĩ   (chữ
        đang     → chữ)   câu     → giọng)
        nói?)             trả lời)
```

| Khối | Việc nó làm | Mặc định |
|---|---|---|
| **VAD** | Phát hiện người dùng bắt đầu / ngừng nói | Silero (chạy local) |
| **STT** | Chuyển giọng nói thành chữ | Cartesia |
| **LLM** | Đọc hội thoại, sinh câu trả lời | Groq |
| **TTS** | Đọc câu trả lời thành giọng nói | Cartesia |

## Điểm chính

- **Đổi nhà cung cấp chỉ bằng biến môi trường** — không phải sửa code.
  Ví dụ `TTS_PROVIDER=vieneu` để dùng VieNeu-TTS thay cho Cartesia.
- **Tự host được**: STT qua vLLM, TTS qua VieNeu-TTS — chạy trên máy của bạn,
  không cần API trả phí.
- **Chế độ hội thoại có sẵn** (`TURN_PROFILE`): trình duyệt, điện thoại, kiosk,
  điền form — mỗi chế độ quyết định khi nào bot nghe, khi nào được ngắt lời.
- **LLM dự phòng**: cấu hình thêm một LLM thứ hai để chuyển sang khi LLM chính lỗi.

## Chạy thử nhanh

```bash
make env        # tạo .env từ .env.example
# mở .env, điền GROQ_API_KEY và CARTESIA_API_KEY
```

Rồi chạy bot theo một trong hai cách (cùng dùng cổng 7860, chỉ chạy một):

```bash
make dev        # trong Docker
# hoặc, không dùng Docker (cần uv: https://docs.astral.sh/uv/)
uv sync         # lần đầu
make run-local
```

Mở <http://localhost:7860/client>, cho phép micro và bắt đầu nói.

Dùng STT/TTS tự host (vLLM, VieNeu-TTS) thì các server đó phải đang chạy ở
`STT_BASE_URL` / `TTS_BASE_URL` trong `.env`. Khi chạy bằng `make dev`,
`localhost` là chính container, không phải máy của bạn.

### Giao diện web kiểu ChatGPT Voice

Bot chạy rồi thì mở thêm một terminal:

```bash
make web-install   # lần đầu, cần Node.js 22.12+
make web-dev       # http://localhost:5173
```

Yêu cầu chi tiết và cách public qua Cloudflare Tunnel: xem [apps/web](apps/web/README.md).

## Tài liệu

| Tài liệu | Đọc khi bạn muốn… |
|---|---|
| [Bắt đầu](docs/getting-started.md) | Cài đặt, chạy bot, tự host STT/TTS |
| [Cấu hình](docs/configuration.md) | Biết từng biến môi trường làm gì |
| [Nhà cung cấp](docs/providers.md) | Chọn STT / LLM / TTS phù hợp |
| [Kiến trúc](docs/architecture.md) | Hiểu code được tổ chức ra sao |
| [Lượt nói](docs/turn-taking.md) | Hiểu cách bot biết lúc nào nghe, lúc nào nói |
| [Lộ trình](docs/roadmap.md) | Xem đã có gì, sắp làm gì |
| [License](docs/licenses.md) | Biết điều khoản của thư viện, model và dịch vụ đang dùng |
