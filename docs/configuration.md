# Cấu hình

Mọi cấu hình nằm trong file `.env` (tạo bằng `make env`). Mỗi biến là một dòng
`TÊN=giá_trị`. Biến nào để trống thì bot dùng giá trị mặc định.

Thứ tự ưu tiên:

1. Biến trong `.env`
2. Giá trị mặc định theo nhà cung cấp — trong `voice_agent/config/defaults.py`

Code đọc cấu hình: `voice_agent/config/settings.py`.

## API key

Mỗi nhà cung cấp đọc key từ tên quen thuộc của nó:

| Nhà cung cấp | Biến |
|---|---|
| Groq | `GROQ_API_KEY` |
| Cartesia | `CARTESIA_API_KEY` |
| Gemini | `GOOGLE_API_KEY` |
| Deepgram | `DEEPGRAM_API_KEY` |
| OpenAI | `OPENAI_API_KEY` |
| Baseten | `BASETEN_API_KEY` |
| vLLM (tự host) | `VLLM_API_KEY` — đặt `EMPTY` nếu server không yêu cầu |
| VieNeu-TTS (tự host) | `VIENEU_API_KEY` — đặt `EMPTY` nếu server không yêu cầu |
| Daily (phòng gọi) | `DAILY_API_KEY` |

Có thể ghi đè riêng từng khối bằng `LLM_API_KEY`, `STT_API_KEY`, `TTS_API_KEY`.
Thiếu key thì bot dừng ngay lúc khởi động và báo tên biến cần điền.

## LLM

| Biến | Ý nghĩa | Mặc định |
|---|---|---|
| `LLM_PROVIDER` | `groq` · `openai` · `gemini` · `baseten` | `groq` |
| `LLM_MODEL` | Tên model | theo nhà cung cấp |
| `LLM_TEMPERATURE` | Độ "sáng tạo" của câu trả lời | `0.2` |
| `LLM_MAX_TOKENS` | Độ dài tối đa một câu trả lời | `1024` |
| `LLM_SYSTEM_INSTRUCTION` | Lời dặn cho bot (tính cách, ngôn ngữ…) | xem `config/prompts.py` |

**LLM dự phòng** — đặt `LLM_FALLBACK_PROVIDER` (và tuỳ chọn `LLM_FALLBACK_MODEL`)
để có LLM thứ hai. Các biến `LLM_FALLBACK_*` giống hệt nhóm `LLM_*` ở trên.

## STT (giọng nói → chữ)

| Biến | Ý nghĩa | Mặc định |
|---|---|---|
| `STT_PROVIDER` | `cartesia` · `deepgram` · `gemini` · `groq` · `vllm` · `vllm_realtime` | `cartesia` |
| `STT_MODEL` | Tên model | theo nhà cung cấp |
| `STT_BASE_URL` | Địa chỉ server — chỉ cho `groq`, `vllm`, `vllm_realtime` | theo nhà cung cấp |
| `STT_LANGUAGE` | Ngôn ngữ người dùng nói | `vi` |

## TTS (chữ → giọng nói)

| Biến | Ý nghĩa | Mặc định |
|---|---|---|
| `TTS_PROVIDER` | `cartesia` · `gemini` · `vieneu` · `deepgram` · `groq` | `cartesia` |
| `TTS_MODEL` | Tên model | theo nhà cung cấp |
| `TTS_VOICE` | Giọng đọc (Cartesia: ID; VieNeu: tên, ví dụ `"Mai Anh"`) | theo nhà cung cấp |
| `TTS_BASE_URL` | Địa chỉ server — chỉ cho `vieneu` | `http://localhost:8001/v1` |
| `TTS_LANGUAGE` | Ngôn ngữ bot nói | `vi` |

Với Cartesia, có thể đặt giọng bằng `CARTESIA_VOICE_ID` thay cho `TTS_VOICE`.

## Khác

| Biến | Ý nghĩa | Mặc định |
|---|---|---|
| `TURN_PROFILE` | Chế độ hội thoại: `webrtc` · `telephony` · `kiosk` · `intake` — xem [turn-taking.md](turn-taking.md) | `webrtc` |
| `LOG_LEVEL` | Mức log: `DEBUG` · `INFO` · `WARNING` | `DEBUG` |
| `PORT` | Cổng server khi chạy `make up` | `8080` |

## Ví dụ

Toàn bộ dùng dịch vụ đám mây (mặc định):

```env
GROQ_API_KEY=...
CARTESIA_API_KEY=...
```

LLM Gemini, STT và TTS tự host:

```env
GOOGLE_API_KEY=...
LLM_PROVIDER=gemini

VLLM_API_KEY=EMPTY
STT_PROVIDER=vllm_realtime
STT_BASE_URL=ws://localhost:8000/v1/realtime

VIENEU_API_KEY=EMPTY
TTS_PROVIDER=vieneu
TTS_VOICE="Mai Anh"
```

> Mỗi biến chỉ nên xuất hiện **một lần** trong `.env`. Ghi chú nên đặt trên dòng
> riêng, bắt đầu bằng `#`.
