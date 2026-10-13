# Nhà cung cấp

Mỗi khối STT / LLM / TTS có nhiều lựa chọn. Chọn bằng biến `*_PROVIDER` trong
`.env`; model mặc định của từng lựa chọn nằm trong `voice_agent/config/defaults.py`.

Hai cách xử lý âm thanh cần phân biệt:

- **Streaming**: gửi âm thanh liên tục, nhận kết quả ngay khi đang nói → nhanh.
- **Theo câu**: chờ người dùng nói xong mới gửi cả câu → chậm hơn một chút.

## STT — giọng nói → chữ

| `STT_PROVIDER` | Cách xử lý | Tiếng Việt | Ghi chú |
|---|---|---|---|
| `cartesia` *(mặc định)* | Streaming | Có | |
| `deepgram` | Streaming | Có | |
| `gemini` | Streaming | Có | |
| `groq` | Theo câu | Có | Whisper |
| `vllm` | Theo câu | Tuỳ model | Tự host — Qwen3-ASR hợp với cách này |
| `vllm_realtime` | Streaming | Tuỳ model | Tự host — server tự nhận ngôn ngữ |

## LLM — sinh câu trả lời

| `LLM_PROVIDER` | Model mặc định |
|---|---|
| `groq` *(mặc định)* | `openai/gpt-oss-120b` |
| `openai` | `gpt-4o-mini` |
| `gemini` | `gemini-3.1-flash-lite` |
| `baseten` | `openai/gpt-oss-120b` |

## TTS — chữ → giọng nói

| `TTS_PROVIDER` | Tiếng Việt | Ghi chú |
|---|---|---|
| `cartesia` *(mặc định)* | Có | Giọng là ID dạng UUID |
| `gemini` | Có | |
| `vieneu` | Có (chỉ tiếng Việt) | Tự host; giọng là tên, ví dụ `Mai Anh`, `Trúc Ly` |
| `deepgram` | **Không** | Chỉ tiếng Anh |
| `groq` | **Không** | Chỉ tiếng Anh |

Bot mặc định trả lời bằng tiếng Việt, nên **đừng chọn `deepgram` hoặc `groq` cho
TTS** trừ khi đổi ngôn ngữ.

## Tự host

`vllm`, `vllm_realtime` và `vieneu` cần server riêng chạy trên máy có GPU.
Cách chạy và kiểm tra: [getting-started.md — mục 5](getting-started.md#5-tự-host-stt-và-tts-tuỳ-chọn).
