# License

Dự án dùng ba loại thành phần, mỗi loại có điều khoản khác nhau:

1. **Thư viện mã nguồn mở** — cài cùng bot (`uv sync`).
2. **Model chạy local / tự host** — trọng số model tải về máy bạn.
3. **Dịch vụ đám mây** — gọi qua API, không có "license" mà có **điều khoản sử dụng**
   của nhà cung cấp.

> Thông tin kiểm tra ngày **2026-10-11**. License có thể thay đổi theo phiên bản —
> trước khi dùng thương mại, hãy đọc lại trang gốc. Đây không phải tư vấn pháp lý.

## Tóm tắt

- Toàn bộ thư viện và model **dùng theo mặc định** đều là license **dễ dãi**
  (MIT, BSD, Apache-2.0): được dùng thương mại, chỉ cần giữ thông báo bản quyền.
- Dịch vụ đám mây: tuân theo điều khoản của từng nhà cung cấp — thường có giới hạn
  về dữ liệu, mục đích sử dụng và chi phí.
- **Bản thân repo này chưa có file `LICENSE`** — nghĩa là mặc định người khác không
  có quyền dùng lại code. Nếu muốn mở mã nguồn, cần thêm một file `LICENSE`.

## 1. Thư viện chính

| Thư viện | Dùng để | License |
|---|---|---|
| [pipecat-ai](https://github.com/pipecat-ai/pipecat) | Khung xây dựng voice agent | BSD-2-Clause |
| pipecatcloud | Chạy trên Pipecat Cloud | BSD-2-Clause |
| daily-python | Kết nối phòng Daily | BSD-2-Clause |
| aiortc | Kết nối WebRTC | BSD-3-Clause |
| openai | Client cho OpenAI và server tương thích (vLLM, VieNeu) | Apache-2.0 |
| groq | Client Groq | Apache-2.0 |
| google-genai | Client Gemini | Apache-2.0 |
| deepgram-sdk | Client Deepgram | MIT |
| websockets | Kết nối WebSocket (vLLM realtime) | BSD-3-Clause |
| onnxruntime | Chạy model VAD / Smart Turn | MIT |
| pydantic, pydantic-settings | Đọc cấu hình | MIT |
| loguru | Ghi log | MIT |
| python-dotenv | Đọc file `.env` | BSD-3-Clause |

Image Docker gốc `dailyco/pipecat-base` do Daily phát hành, đi kèm Pipecat.

Xem license của mọi package đã cài:

```bash
uv run python -c "from importlib.metadata import distributions as d; \
[print(x.metadata['Name'], '-', x.metadata.get('License-Expression') or x.metadata.get('License')) for x in d()]"
```

## 2. Model chạy local và tự host

| Model / phần mềm | Dùng để | Chạy ở đâu | License |
|---|---|---|---|
| [Silero VAD](https://github.com/snakers4/silero-vad) | Phát hiện tiếng nói | Trong bot (đi kèm Pipecat) | MIT |
| [Smart Turn v3](https://github.com/pipecat-ai/smart-turn) | Đoán người dùng nói xong chưa | Trong bot (đi kèm Pipecat) | BSD-2-Clause |
| [vLLM](https://github.com/vllm-project/vllm) | Server chạy model STT | Server tự host | Apache-2.0 |
| [Qwen3-ASR](https://huggingface.co/Qwen/Qwen3-ASR-0.6B) | Model STT mặc định khi tự host | Server tự host | Apache-2.0 |
| [VieNeu-TTS v3 Turbo](https://huggingface.co/pnnbao-ump/VieNeu-TTS-v3-Turbo) | Model TTS tiếng Việt | Server tự host | Apache-2.0 |

**Lưu ý với VieNeu-TTS**

- Giọng có sẵn và âm thanh tạo ra được phép dùng cho nội dung thương mại.
- Model card yêu cầu **không dùng để mạo danh, lừa đảo, hoặc nhân bản giọng người
  thật khi chưa được đồng ý**.
- Chỉ bản v3 Turbo trở về trước là mã nguồn mở; tác giả cho biết v4 là bản độc quyền.

Nếu đổi sang model khác (ví dụ một model STT khác trên vLLM), hãy kiểm tra license
trên trang Hugging Face của model đó.

## 3. Dịch vụ đám mây

Gọi qua API key; việc sử dụng tuân theo điều khoản của nhà cung cấp, không phải
license mã nguồn. Model mở chạy trên dịch vụ đám mây (ví dụ `gpt-oss-120b`,
Apache-2.0, trên Groq / Baseten) vẫn chịu thêm điều khoản của nhà cung cấp đó.

| Dịch vụ | Dùng cho | Điều khoản |
|---|---|---|
| Groq | LLM, STT, TTS | <https://groq.com/terms-of-use> |
| Cartesia | STT, TTS | <https://cartesia.ai/legal/terms> |
| Deepgram | STT, TTS | <https://deepgram.com/terms> |
| Google Gemini | LLM, STT, TTS | <https://ai.google.dev/gemini-api/terms> |
| OpenAI | LLM | <https://openai.com/policies/terms-of-use> |
| Baseten | LLM | <https://www.baseten.co/terms-and-conditions> |
| Daily | Phòng gọi, WebRTC | <https://www.daily.co/legal/terms-of-service> |

Những điểm nên đọc kỹ trong điều khoản:

- **Dữ liệu**: âm thanh và hội thoại gửi lên có được lưu hoặc dùng để huấn luyện không.
- **Mục đích**: một số dịch vụ cấm dùng cho lĩnh vực nhất định (y tế, pháp lý…)
  hoặc yêu cầu thông báo cho người dùng rằng họ đang nói chuyện với AI.
- **Giọng nói tổng hợp**: hầu hết cấm nhân bản giọng người khác khi chưa được phép.
