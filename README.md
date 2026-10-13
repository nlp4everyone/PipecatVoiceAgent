# VoiceAgent

Trợ lý giọng nói **tiếng Việt**, hội thoại theo thời gian thực, xây trên
[Pipecat](https://docs.pipecat.ai). Người dùng nói qua trình duyệt (WebRTC) hoặc
phòng Daily; bot nghe, hiểu, trả lời bằng giọng nói — và có thể bị ngắt lời giữa
chừng như khi nói chuyện với người thật.

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
make dev        # chạy bot trong Docker
```

Mở <http://localhost:7860/client>, cho phép micro và bắt đầu nói.

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
