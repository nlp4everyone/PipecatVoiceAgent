# Kiến trúc VoiceAgent (bản nháp)

> Trạng thái: **đã triển khai** (2026-09-13) trong `voice_agent/` (package phẳng ở root). `bot.py` ở root là shim.
> Chạy: `uv run bot.py` (chat tự do) hoặc `SCENARIO=intake uv run bot.py` (kịch bản intake).
> Cấu hình qua env: xem `.env.example`.
>
> Nguồn tham chiếu:
> - https://docs.pipecat.ai/api-reference/server/utilities/turn-management/user-turn-strategies
> - https://docs.pipecat.ai/api-reference/server/utilities/turn-management/user-mute-strategies
> - https://docs.pipecat.ai/pipecat/fundamentals/interruptions

---

## 1. Điểm rút ra từ Pipecat quyết định cách tổ chức

1. **Turn strategies và mute strategies là *policy*, không phải *event*.**
   Chúng là danh sách object được truyền vào `LLMUserAggregatorParams` lúc khởi tạo
   (`user_turn_strategies=UserTurnStrategies(start=[...], stop=[...])`,
   `user_mute_strategies=[...]`). Không giữ state của ta, không có logic hội thoại
   → thuộc nhóm **factory / config**.

2. **Interruption không phải một module riêng.** Nó là tổng hợp của:
   - `enable_interruptions=True/False` trên *start strategy* (config);
   - mute strategy để bỏ speech chồng lấn (config);
   - quan sát qua `on_assistant_turn_stopped` với `message.interrupted` (event);
   - trigger tay bằng `broadcast_interruption()` trong FrameProcessor hoặc
     `worker.queue_frame(InterruptionWorkerFrame())` (processor).

   → Config nằm ở `turns/`, phản ứng nằm ở `events/`, trigger tay nằm ở `pipeline/processors/`.

3. **Event handler trong Pipecat bám vào *instance*, không bám vào class.**
   `@transport.event_handler`, `@user_aggregator.event_handler("on_user_mute_started")`,
   `@assistant_aggregator.event_handler("on_assistant_turn_stopped")`,
   `@strategy.event_handler("on_wake_phrase_detected")`, `@worker.rtvi.event_handler("on_client_ready")`.

   Hệ quả: **không thể decorate ở module-level lúc import** — phải đăng ký *sau khi*
   object đã được tạo, và handler cần tham chiếu tới nhiều object khác
   (worker, context, flow_manager…). Nếu để hết trong `run_bot()` như hiện tại, hàm
   sẽ phình vô hạn khi thêm các mục trong `note.txt`.

---

## 2. Cây thư mục đích

### 2.1 Layout: `voice_agent/` + `bot.py` shim ở root

Dùng **package phẳng ở root** (`voice_agent/`). Ràng buộc: base image `dailyco/pipecat-base` (và Pipecat Cloud)
tìm `/app/bot.py` và gọi `bot(runner_args)` → `bot.py` **phải** ở root, nhưng chỉ là shim:

```python
# bot.py — entrypoint cho pipecat-base / Pipecat Cloud. Không chứa logic.
from voice_agent.main import bot  # noqa: F401

if __name__ == "__main__":
    from pipecat.runner.run import main
    main()
```

```
VoiceAgent/
├── bot.py                 # shim
├── pyproject.toml         # thêm [build-system] hatchling, packages = ["voice_agent"]
├── Dockerfile             # COPY ./voice_agent ./voice_agent rồi `uv sync --locked --no-dev` để cài package
├── docs/
├── tests/
└── voice_agent/       # cây bên dưới
```

Package phẳng ở root: bớt một cấp thư mục so với src layout; package vẫn được cài
qua hatchling nên Docker và local import giống nhau (`voice_agent.*`).

Chi phí một lần: `pyproject.toml` hiện **không có `[build-system]`** và Dockerfile chạy
`uv sync --no-install-project` → phải thêm:

```toml
[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.hatch.build.targets.wheel]
packages = ["voice_agent"]
```

```dockerfile
# giữ bước --no-install-project đầu để cache layer dependencies
COPY ./voice_agent ./voice_agent
COPY ./pyproject.toml ./uv.lock ./bot.py ./
RUN --mount=type=cache,target=/root/.cache/uv uv sync --locked --no-dev
```

Local `uv run bot.py` không đổi (uv tự cài project editable).

### 2.2 Cây bên trong `voice_agent/`

```
voice_agent/
├── main.py                    # wiring 5 bước: services → turns → pipeline → events → run
├── config/
│   ├── prompts.py             # DEFAULT_SYSTEM_INSTRUCTION (free-chat system prompt)
│   ├── providers.py           # LLMProvider/STTProvider/TTSProvider enums + LEGACY_KEY_ENV
│   ├── settings.py            # Settings (pydantic-settings, env nested "__"), LLMConfig/STTConfig/TTSConfig
│   └── profiles.py            # TurnProfile + PROFILES: webrtc | telephony | kiosk | intake
├── services/                  # factory đơn giản: create_x(cfg) với `match cfg.provider`
│   ├── __init__.py            # Services dataclass + build_services(settings)
│   ├── llm.py                 # baseten | openai_compat (Groq/vLLM/Ollama…) | openai_responses | anthropic
│   ├── stt.py                 # deepgram | gemini | groq | cartesia
│   ├── tts.py                 # cartesia | deepgram | elevenlabs | gemini | groq | openai_compat
│   └── vad.py                 # Silero
├── turns/                     # TurnProfile → strategies, hàm thuần, không state
│   ├── params.py              # build_user_turn(profile, vad, start=None) -> UserTurnSetup
│   ├── start.py  stop.py  mute.py
├── pipeline/
│   ├── builder.py             # build_aggregators / build_llm (LLMSwitcher nếu có fallback) / build_pipeline / build_worker
│   ├── processors/            # (trống) FrameProcessor tuỳ biến
│   └── observers/             # (trống)
├── events/                    # register(ctx) mỗi file, register_all(ctx)
│   ├── context.py             # SessionContext
│   ├── transport.py           # on_client_connected / disconnected
│   ├── rtvi.py                # on_client_ready → LLMRunFrame
│   ├── turns.py               # on_user_turn_started/stopped/stop_timeout + wake phrase events
│   ├── mute.py                # on_user_mute_started/stopped
│   └── interruptions.py       # on_assistant_turn_stopped → message.interrupted
└── (scenarios/ tạm gỡ — xem _parked/scenarios/, phát triển sau)
```

`bot_test.py` cũ đã gộp vào `main.py` dưới dạng `SCENARIO=intake` + `TURN_PROFILE=intake`
(`filter_incomplete_user_turns=True`).

### Nguyên tắc chia

| Folder       | Trả lời câu hỏi              | Tính chất                          |
|--------------|------------------------------|------------------------------------|
| `turns/`     | Bot **nên nghe** thế nào?    | Policy, quyết định lúc build       |
| `events/`    | Khi **X xảy ra** thì làm gì? | Reaction, runtime                  |
| `scenarios/` | Bot **nói gì**?              | Domain (Flows) — tạm gỡ, ở `_parked/` |
| `services/`  | Dùng **nhà cung cấp** nào?   | Factory                            |

Ba folder `turns/`, `events/`, `scenarios/` **không import chéo nhau**. Chỉ `main.py`
biết cả ba.

---

## 3. Thiết kế event handler

### 3.1 `events/context.py` — giải bài toán closure / DI

```python
from dataclasses import dataclass, field

@dataclass
class SessionContext:
    transport: BaseTransport
    worker: PipelineWorker
    llm_context: LLMContext
    user_aggregator: ...
    assistant_aggregator: ...
    flow_manager: FlowManager | None = None
    strategies: list = field(default_factory=list)   # để đăng ký event của strategy (wake phrase)
    settings: Settings = ...
    # state per-session mà handler cần chia sẻ
    stats: dict = field(default_factory=dict)        # vd: số lần bị ngắt
```

- Mọi handler chỉ nhận `ctx`. Không global, không closure lồng trong `run_bot`.
- Test handler bằng fake object thay vào `SessionContext`.
- **Không** biến thành singleton — mọi thứ trong `run_bot` vốn đã per-session,
  `SessionContext` chỉ formalize điều đó.

### 3.2 Mỗi file `events/*.py` expose đúng một hàm `register(ctx)`

```python
# events/interruptions.py
def register(ctx: SessionContext) -> None:
    @ctx.assistant_aggregator.event_handler("on_assistant_turn_stopped")
    async def on_assistant_turn_stopped(aggregator, message):
        if message.interrupted:
            ctx.stats["interruptions"] = ctx.stats.get("interruptions", 0) + 1
            logger.info(f"Bot bị ngắt sau khi nói: {message.content!r}")
```

```python
# events/mute.py
def register(ctx: SessionContext) -> None:
    @ctx.user_aggregator.event_handler("on_user_mute_started")
    async def on_mute_started(aggregator):
        logger.debug("user muted")

    @ctx.user_aggregator.event_handler("on_user_mute_stopped")
    async def on_mute_stopped(aggregator):
        logger.debug("user unmuted")
```

```python
# events/__init__.py
from . import transport, rtvi, turns, mute, interruptions, idle

_REGISTRARS = (
    transport.register,
    rtvi.register,
    turns.register,
    mute.register,
    interruptions.register,
    idle.register,
)

def register_all(ctx: SessionContext) -> None:
    for reg in _REGISTRARS:
        reg(ctx)
```

**Chia file theo nguồn phát event** (transport / rtvi / user_aggregator /
assistant_aggregator / strategy), không chia theo tính năng. Lý do: docs Pipecat tổ
chức đúng như vậy, và khi debug ta tìm handler theo "object nào emit".

### 3.3 Ngoại lệ: event của *strategy*

`WakePhraseUserTurnStartStrategy` emit `on_wake_phrase_detected` / `on_wake_phrase_timeout`
trên chính instance strategy — instance đó được tạo trong `turns/start.py`.

- **Chọn:** `build_start_strategies()` trả về list; `main.py` giữ tham chiếu, bỏ vào
  `ctx.strategies`; `events/turns.py` duyệt list và đăng ký handler cho strategy phù hợp.
  `turns/` giữ sạch, không side-effect.
- **Không:** đăng ký handler ngay trong `turns/start.py` — trộn policy với reaction,
  khiến `turns/` phụ thuộc `ctx`.

### 3.4 Quy tắc viết handler

- **Mỏng và không block.** `on_user_turn_started` nằm trên hot path của barge-in.
  Cần I/O (ghi DB, webhook) → `ctx.worker.create_task(...)` / fire-and-forget,
  không `await` trực tiếp.
- **Không đặt logic hội thoại vào handler.** Kick-off (`on_client_ready` → `LLMRunFrame`)
  là ngoại lệ hợp lý; "hỏi slot tiếp theo" thuộc `scenarios/` (Flows).
- **Manual interruption** (`broadcast_interruption()`) là việc của FrameProcessor
  → `pipeline/processors/`, không phải `events/`.

---

## 4. `turns/` — nơi duy nhất quyết định hành vi nghe / ngắt

```python
# turns/__init__.py
def build_user_turn(profile: TurnProfile, vad) -> UserTurnSetup:
    return LLMUserAggregatorParams(
        vad_analyzer=vad,
        user_turn_strategies=UserTurnStrategies(
            start=build_start_strategies(profile),   # MinWords(3) / VAD(enable_interruptions=...)
            stop=build_stop_strategies(profile),     # SmartTurn / SpeechTimeout
        ),
        user_mute_strategies=build_mute_strategies(profile),  # Always / FirstSpeech / FunctionCall
        user_turn_stop_timeout=profile.turn_stop_timeout,
    )
```

```python
# config/profiles.py
@dataclass(frozen=True)
class TurnProfile:
    start: Literal["vad", "min_words", "wake_phrase", "custom"] = "vad"
    min_words: int = 3
    wake_phrases: tuple[str, ...] = ()
    stop: Literal["smart_turn", "speech_timeout"] = "smart_turn"
    speech_timeout: float = 0.6
    turn_stop_timeout: float = 5.0
    enable_interruptions: bool = True
    mute: Literal["none", "always", "first_speech", "until_first_complete"] = "first_speech"
    mute_during_function_calls: bool = True

PROFILES = {
    "webrtc":    TurnProfile(),
    "telephony": TurnProfile(start="min_words", stop="speech_timeout", mute="always"),
    "kiosk":     TurnProfile(start="wake_phrase", wake_phrases=("xin chào bot",)),
}
```

`profiles.py` là dataclass thuần → đổi `AlwaysUserMuteStrategy` sang
`FirstSpeechUserMuteStrategy` + `MinWords(3)` là đổi 1 dòng config; unit-test
`build_*` không cần pipeline.

Bảng tra nhanh strategy Pipecat:

| Nhóm  | Class                                    | Tham số chính                                  |
|-------|------------------------------------------|------------------------------------------------|
| start | `VADUserTurnStartStrategy`               | `enable_interruptions`                         |
| start | `TranscriptionUserTurnStartStrategy`     | `use_interim`                                  |
| start | `MinWordsUserTurnStartStrategy`          | `min_words`, `use_interim`                     |
| start | `WakePhraseUserTurnStartStrategy`        | `phrases`, `timeout`, `single_activation`      |
| start | `KrispVivaIPUserTurnStartStrategy`       | `threshold`, `model_path` (lọc backchannel)    |
| start | `ExternalUserTurnStartStrategy`          | — (S2S: Gemini Live, OpenAI Realtime)          |
| stop  | `TurnAnalyzerUserTurnStopStrategy`       | `turn_analyzer=LocalSmartTurnAnalyzerV3()`     |
| stop  | `SpeechTimeoutUserTurnStopStrategy`      | `user_speech_timeout`, `wait_for_transcript`   |
| stop  | `EagerUserTurnStopStrategy`              | `match_policy`, `speculation_timeout`          |
| stop  | `LLMTurnCompletionUserTurnStopStrategy`  | `config` (dùng với `deferred(...)`)            |
| mute  | `AlwaysUserMuteStrategy`                 | mute mỗi khi bot nói                           |
| mute  | `FirstSpeechUserMuteStrategy`            | chỉ mute lời chào đầu                          |
| mute  | `MuteUntilFirstBotCompleteUserMuteStrategy` | mute từ lúc start pipeline tới hết lời đầu  |
| mute  | `FunctionCallUserMuteStrategy`           | mute trong lúc function call                   |

Mute strategies kết hợp theo **OR**. Tắt interruption **không** bỏ qua speech của
user — chỉ xếp hàng response; muốn bỏ hẳn thì dùng mute.

---

## 4b. `services/` — factory đơn giản

Mỗi kind (llm/stt/tts) có một `XConfig` pydantic và một `create_x(cfg)` dùng `match cfg.provider`.
Nhánh `openai_compat` phủ mọi endpoint OpenAI-compatible qua `base_url`. Thêm provider = thêm
một `case`. API key đọc từ `LLM__API_KEY`… hoặc fallback tên quen (`BASETEN_API_KEY`,
`DEEPGRAM_API_KEY`, `CARTESIA_API_KEY`) để `.env` cũ vẫn chạy. `LLM_FALLBACK__*` bật `LLMSwitcher`.

## 5. `main.py` chỉ còn wiring

```python
async def run_bot(transport, runner_args):
    settings = Settings()
    profile = PROFILES[settings.turn_profile]

    stt, llm, tts = services.build(settings)
    vad = services.vad.build(settings)

    user_turn = turns.build_user_turn(profile, vad)  # .params + .start_strategies
    llm_context, user_agg, assistant_agg = pipeline.build_aggregators(user_params)
    worker = pipeline.build_worker(transport, stt, user_agg, llm, tts, assistant_agg)

    ctx = SessionContext(
        transport=transport, worker=worker, llm_context=llm_context,
        user_aggregator=user_agg, assistant_aggregator=assistant_agg,
        strategies=strategies_start, settings=settings,
    )
    events.register_all(ctx)          # toàn bộ handler ở đây

    runner = WorkerRunner(handle_sigint=False)
    await runner.add_workers(worker)
    await runner.run()
```

---

## 6. Ánh xạ roadmap trong `note.txt` vào cây

| Mục trong note.txt              | Vị trí                                        |
|---------------------------------|-----------------------------------------------|
| Interruptions                   | `turns/` (config) + `events/interruptions.py` |
| User/Assistant turn management  | `turns/` + `events/turns.py`                  |
| Smart Turn                      | `turns/stop.py`                               |
| VAD, Audio filters              | `services/vad.py`, `services/audio_filters.py`|
| Detecting user idle             | `pipeline/processors/` + `events/idle.py`     |
| Pipeline termination            | `events/transport.py` / `events/idle.py`      |
| Context summarize               | `pipeline/builder.py`                         |
| Text aggregator / voice formatter | `services/tts.py`                           |
| Custom LLM/ASR/TTS              | `services/`                                   |
| Memory (mem0)                   | `services/memory.py`                          |
| Transcript, recording, OTel     | `telemetry/`                                  |
| Observers                       | `pipeline/observers/`                         |
| Service switcher                | `services/`                                   |
| Runner config                   | `config/settings.py`, `main.py`               |
| RTVI                            | `events/rtvi.py`                              |

---

## 7. Lộ trình chuyển đổi (bước 1–2 đã xong)

1. **Bước 1 (hạ tầng):** tạo `voice_agent/`, thêm `[build-system]` + Dockerfile như 2.1,
   `bot.py` thành shim, `main.py` chứa nội dung `run_bot` hiện tại. Xác nhận `uv run bot.py`
   và `docker build` vẫn chạy trước khi tách gì thêm.
2. **Bước 2:** tách `main.py` thành `turns/` + `events/` + `config/profiles.py`;
   chuyển `slot_engine.py` → `scenarios/engine.py`, `scenario_intake.py` →
   `scenarios/intake.py`; thêm `services/`.
3. **Bước 3:** thêm dần `pipeline/processors/`, `telemetry/`, `tests/` khi triển khai
   các mục trong `note.txt`.
