# Bắt đầu

## 1. Cần chuẩn bị

- **Docker** (cách dễ nhất), hoặc **Python 3.11+** và [uv](https://docs.astral.sh/uv/)
  nếu muốn chạy thẳng trên máy.
- **API key** cho các dịch vụ mặc định:
  - `GROQ_API_KEY` — LLM
  - `CARTESIA_API_KEY` — STT và TTS

  Muốn dùng nhà cung cấp khác thì xem [providers.md](providers.md).

## 2. Cấu hình

```bash
make env
```

Lệnh này tạo file `.env` từ `.env.example`. Mở `.env` và điền API key.
Mọi biến khác đều có giá trị mặc định — xem [configuration.md](configuration.md).

## 3. Chạy bot

| Cách chạy | Lệnh | Dùng khi |
|---|---|---|
| Docker, chế độ dev | `make dev` | Phát triển hằng ngày — sửa code là có hiệu lực |
| Không dùng Docker | `make run-local` | Chạy thẳng bằng `uv` trên máy |
| Docker, chế độ server | `make up` | Chạy giống môi trường triển khai thật |

Với `make dev` / `make run-local`: mở <http://localhost:7860/client>, cho phép
micro, rồi nói. Bot sẽ tự giới thiệu trước.

Với `make up`: bot chạy dưới dạng server ở cổng `8080` (đổi bằng `PORT`), chờ
lệnh `POST /bot` để mở phiên. Kiểm tra server sống bằng `make health`.

`make help` liệt kê mọi lệnh có sẵn.

## 4. Biết bot đã chạy đúng

Trong log, ngay khi có người kết nối:

```
Starting bot — llm=groq/... stt=cartesia tts=cartesia profile=webrtc
Client connected
```

Nếu bot báo thiếu API key hoặc không kết nối được dịch vụ, kiểm tra lại `.env`.

## 5. Tự host STT và TTS (tuỳ chọn)

Thay vì dùng dịch vụ trả phí, có thể chạy STT và TTS trên máy có GPU. Hai server
này chạy **bên ngoài** repo; bot chỉ gọi tới chúng.

| Dịch vụ | Server | Cổng mặc định | Đường dẫn bot dùng |
|---|---|---|---|
| STT | vLLM | `8000` | `/v1/audio/transcriptions` hoặc `/v1/realtime` |
| TTS | VieNeu-TTS | `8001` | `/v1/audio/speech` |

**STT bằng vLLM**

```bash
vllm serve Qwen/Qwen3-ASR-0.6B --port 8000
```

```env
VLLM_API_KEY=EMPTY
STT_PROVIDER=vllm_realtime        # nhận dạng liên tục (hoặc: vllm — gửi từng câu)
STT_MODEL=Qwen/Qwen3-ASR-0.6B
STT_BASE_URL=ws://localhost:8000/v1/realtime   # với vllm: http://localhost:8000/v1
```

**TTS bằng VieNeu-TTS**

```env
VIENEU_API_KEY=EMPTY
TTS_PROVIDER=vieneu
TTS_VOICE="Mai Anh"
TTS_BASE_URL=http://localhost:8001/v1
```

Danh sách giọng: `curl localhost:8001/v1/voices`.

**Kiểm tra server trước khi chạy bot**

```bash
curl localhost:8000/v1/models    # vLLM: phải thấy tên model STT
curl localhost:8001/health       # VieNeu: {"status":"ok", ...}
```

> **Lưu ý cổng:** STT và TTS chạy ở hai cổng khác nhau. Trỏ nhầm STT sang cổng
> của VieNeu sẽ gặp lỗi `server rejected WebSocket connection: HTTP 403`.
>
> **Lưu ý Docker:** khi bot chạy trong Docker (`make dev`, `make up`),
> `localhost` là chính container. Thay bằng IP của máy đang chạy vLLM / VieNeu.
