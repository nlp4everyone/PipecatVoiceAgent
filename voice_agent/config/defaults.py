"""Per-provider defaults for LLM / STT / TTS, used when a config field is unset.

Single source of truth for "what to use when the user didn't say" — the
``services/*/factory.py`` modules only wire providers to Pipecat classes, they
don't carry data. A value here is the last resort: the nested env var
(``LLM__MODEL``, ``STT__LANGUAGE``, ...) or the flat one (``STT_MODEL``,
``STT_BASE_URL``, ``TTS_MODEL``, see ``settings.py``) always wins when set.
"""

from voice_agent.config.providers import LLMProvider, STTProvider, TTSProvider

LLM_DEFAULT_MODEL: dict[LLMProvider, str] = {
    LLMProvider.BASETEN: "openai/gpt-oss-120b",
    LLMProvider.OPENAI: "gpt-4o-mini",
    LLMProvider.GEMINI: "gemini-3.1-flash-lite",
    LLMProvider.GROQ: "openai/gpt-oss-120b",
}

STT_DEFAULT_MODEL: dict[STTProvider, str] = {
    STTProvider.DEEPGRAM: "nova-3",
    STTProvider.GEMINI: "gemini-3.5-transcribe-live",
    STTProvider.GROQ: "whisper-large-v3-turbo",
    STTProvider.CARTESIA: "ink-whisper",
}

# Only providers with a configurable endpoint need an entry here.
STT_DEFAULT_BASE_URL: dict[STTProvider, str] = {
    STTProvider.GROQ: "https://api.groq.com/openai/v1",
}

TTS_DEFAULT_MODEL: dict[TTSProvider, str | None] = {
    TTSProvider.CARTESIA: "sonic-3.5",
    TTSProvider.DEEPGRAM: None,  # model is implied by the voice name
    TTSProvider.GEMINI: "gemini-3.1-flash-tts-preview",
    TTSProvider.GROQ: "canopylabs/orpheus-v1-english",
}

TTS_DEFAULT_VOICE: dict[TTSProvider, str] = {
    TTSProvider.CARTESIA: "86e30c1d-714b-4074-a1f2-1cb6b552fb49",
    TTSProvider.DEEPGRAM: "aura-2-helena-en",  # Deepgram TTS: English only
    TTSProvider.GEMINI: "Zephyr",
    TTSProvider.GROQ: "autumn",  # Groq TTS: English only
}
