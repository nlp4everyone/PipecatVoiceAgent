# Kiến trúc

Tài liệu này giúp bạn biết **một tính năng nằm ở thư mục nào** trước khi mở code.

## Một phiên hội thoại diễn ra thế nào

Mỗi khi có người kết nối, Pipecat gọi `bot()` trong `voice_agent/main.py`.
Hàm `run_bot()` dựng phiên qua 5 bước:

```
1. services  ─ tạo STT, LLM, TTS, VAD theo .env
2. turns     ─ chọn luật lượt nói theo TURN_PROFILE
3. pipeline  ─ nối các khối thành một dây chuyền
4. events    ─ gắn các hàm xử lý sự kiện (kết nối, ngắt lời…)
5. run       ─ chạy cho tới khi người dùng rời đi
```

Dây chuyền âm thanh (`pipeline/builder.py`):

```
âm thanh vào → STT → [ghi lời người dùng] → LLM → TTS → âm thanh ra → [ghi lời bot]
```

Lời của bot được ghi **sau** khi phát ra loa, nên nếu bị ngắt giữa chừng, lịch sử
hội thoại chỉ giữ phần bot đã thực sự nói.

## Cấu trúc thư mục

```
bot.py                  điểm vào — chỉ gọi voice_agent.main
voice_agent/
├── main.py             nối 5 bước ở trên; không chứa logic
├── config/             mọi cấu hình, chỉ là dữ liệu
│   ├── settings.py       đọc .env
│   ├── defaults.py       model / giọng / URL mặc định theo nhà cung cấp
│   ├── providers.py      danh sách nhà cung cấp
│   ├── profiles.py       các chế độ hội thoại (TURN_PROFILE)
│   └── prompts.py        lời dặn cho LLM
├── services/           tạo dịch vụ từ cấu hình
│   ├── stt/  llm/  tts/  vad/   mỗi thư mục có factory.py
│   ├── stt/vllm*.py      STT tự host
│   └── tts/vieneu.py     TTS tự host
├── turns/              luật lượt nói: khi nào bắt đầu, kết thúc, bỏ qua
├── pipeline/           thứ tự các khối trong dây chuyền
└── events/             phản ứng với sự kiện: kết nối, ngắt lời, tắt tiếng…
```

## Vì sao chia như vậy

| Thư mục | Chứa gì | Không chứa gì |
|---|---|---|
| `config/` | Dữ liệu: giá trị, danh sách, mặc định | Logic |
| `services/` | Cách tạo một dịch vụ từ cấu hình | Thứ tự dây chuyền |
| `turns/` | **Luật**: bot nghe / ngắt lời ra sao | Phản ứng khi sự kiện xảy ra |
| `pipeline/` | **Thứ tự** các khối | Cách tạo từng khối |
| `events/` | **Phản ứng** khi có sự kiện | Luật hội thoại |

Mỗi thư mục chỉ lo một việc, nên khi thêm tính năng bạn biết ngay phải sửa ở đâu.

## Muốn đổi X thì sửa ở đâu

| Muốn… | Sửa |
|---|---|
| Đổi nhà cung cấp, model, giọng | `.env` — không cần sửa code |
| Đổi tính cách / lời dặn của bot | `config/prompts.py` hoặc `LLM_SYSTEM_INSTRUCTION` |
| Đổi câu mở đầu khi người dùng vào | `events/rtvi.py` |
| Thêm chế độ hội thoại mới | `config/profiles.py` |
| Thêm nhà cung cấp mới | `config/providers.py` → `config/defaults.py` → `services/<loại>/factory.py` |
| Thêm khối vào dây chuyền | `pipeline/builder.py` |
| Làm gì đó khi có sự kiện | file tương ứng trong `events/` |
