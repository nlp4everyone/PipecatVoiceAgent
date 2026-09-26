"""Runtime configuration, read from environment / .env.

Every setting is a flat env var — ``LLM_PROVIDER``, ``STT_MODEL``,
``TTS_VOICE`` ... (single underscore; no nested-delimiter parsing, since a
delimiter can't be told apart from the underscores already inside field names
like ``max_tokens`` or ``system_instruction``). API keys may also be given
under the provider's conventional name (``GROQ_API_KEY``, ``GOOGLE_API_KEY``,
``DEEPGRAM_API_KEY``, ``CARTESIA_API_KEY`` ...), so an existing ``.env`` keeps
working.

``settings.llm`` / ``.llm_fallback`` / ``.stt`` / ``.tts`` are properties that
assemble the corresponding ``*Config`` from the flat fields below, so the rest
of the app (``main.py``, ``services/*/factory.py``) is unaffected by this file
being flat.
"""

import os

from pydantic import BaseModel, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from voice_agent.config.defaults import STT_DEFAULT_BASE_URL, STT_DEFAULT_MODEL, TTS_DEFAULT_MODEL
from voice_agent.config.prompts import DEFAULT_SYSTEM_INSTRUCTION
from voice_agent.config.providers import (
    LEGACY_KEY_ENV,
    LLMProvider,
    STTProvider,
    TTSProvider,
)


class LLMConfig(BaseModel):
    provider: LLMProvider = LLMProvider.GROQ
    model: str | None = None
    api_key: SecretStr | None = None
    base_url: str | None = None  # reserved; not used by any current provider
    temperature: float = 0.2
    max_tokens: int = 1024
    system_instruction: str = DEFAULT_SYSTEM_INSTRUCTION


class STTConfig(BaseModel):
    provider: STTProvider = STTProvider.CARTESIA
    model: str | None = None
    api_key: SecretStr | None = None
    base_url: str | None = None  # groq only (override the OpenAI-compatible endpoint)
    language: str = "vi"


class TTSConfig(BaseModel):
    provider: TTSProvider = TTSProvider.CARTESIA
    api_key: SecretStr | None = None
    voice: str | None = None
    model: str | None = None
    base_url: str | None = None  # reserved; not used by any current provider
    language: str = "vi"


def _resolve_api_key(provider: str, current: SecretStr | None) -> SecretStr:
    """Fill in an API key from its provider's conventional env var when unset."""
    if current is not None:
        return current
    env = LEGACY_KEY_ENV.get(provider)
    value = os.getenv(env) if env else None
    if not value:
        raise ValueError(f"Missing API key for {provider!r}: set *_API_KEY or {env}")
    return SecretStr(value)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # LLM
    llm_provider: LLMProvider = LLMProvider.GROQ
    llm_model: str | None = None  # None = default model for the provider
    llm_api_key: SecretStr | None = None
    llm_base_url: str | None = None
    llm_temperature: float = 0.2
    llm_max_tokens: int = 1024
    llm_system_instruction: str = DEFAULT_SYSTEM_INSTRUCTION

    # Optional fallback LLM (enables LLMSwitcher); provider unset = disabled
    llm_fallback_provider: LLMProvider | None = None
    llm_fallback_model: str | None = None
    llm_fallback_api_key: SecretStr | None = None
    llm_fallback_base_url: str | None = None
    llm_fallback_temperature: float = 0.2
    llm_fallback_max_tokens: int = 1024
    llm_fallback_system_instruction: str = DEFAULT_SYSTEM_INSTRUCTION

    # STT
    stt_provider: STTProvider = STTProvider.CARTESIA
    stt_model: str | None = None
    stt_api_key: SecretStr | None = None
    stt_base_url: str | None = None
    stt_language: str = "vi"

    # TTS
    tts_provider: TTSProvider = TTSProvider.CARTESIA
    tts_api_key: SecretStr | None = None
    tts_voice: str | None = None
    tts_model: str | None = None
    tts_base_url: str | None = None
    tts_language: str = "vi"

    turn_profile: str = "webrtc"  # key in config.profiles.PROFILES
    log_level: str = "DEBUG"

    @model_validator(mode="after")
    def _resolve_fallbacks(self) -> "Settings":
        self.llm_api_key = _resolve_api_key(self.llm_provider, self.llm_api_key)
        if self.llm_fallback_provider is not None:
            self.llm_fallback_api_key = _resolve_api_key(self.llm_fallback_provider, self.llm_fallback_api_key)
        self.stt_api_key = _resolve_api_key(self.stt_provider, self.stt_api_key)
        self.tts_api_key = _resolve_api_key(self.tts_provider, self.tts_api_key)

        # CARTESIA_VOICE_ID is a Cartesia voice UUID; only meaningful for that provider
        if self.tts_provider is TTSProvider.CARTESIA and self.tts_voice is None:
            if voice := os.getenv("CARTESIA_VOICE_ID"):
                self.tts_voice = voice

        # No public default for a self-hosted server; config/defaults.py has the
        # last-resort literal.
        if self.stt_base_url is None:
            self.stt_base_url = STT_DEFAULT_BASE_URL.get(self.stt_provider)
        if self.stt_model is None:
            self.stt_model = STT_DEFAULT_MODEL[self.stt_provider]
        if self.tts_model is None:
            self.tts_model = TTS_DEFAULT_MODEL[self.tts_provider]
        return self

    @property
    def llm(self) -> LLMConfig:
        return LLMConfig(
            provider=self.llm_provider,
            model=self.llm_model,
            api_key=self.llm_api_key,
            base_url=self.llm_base_url,
            temperature=self.llm_temperature,
            max_tokens=self.llm_max_tokens,
            system_instruction=self.llm_system_instruction,
        )

    @property
    def llm_fallback(self) -> LLMConfig | None:
        if self.llm_fallback_provider is None:
            return None
        return LLMConfig(
            provider=self.llm_fallback_provider,
            model=self.llm_fallback_model,
            api_key=self.llm_fallback_api_key,
            base_url=self.llm_fallback_base_url,
            temperature=self.llm_fallback_temperature,
            max_tokens=self.llm_fallback_max_tokens,
            system_instruction=self.llm_fallback_system_instruction,
        )

    @property
    def stt(self) -> STTConfig:
        return STTConfig(
            provider=self.stt_provider,
            model=self.stt_model,
            api_key=self.stt_api_key,
            base_url=self.stt_base_url,
            language=self.stt_language,
        )

    @property
    def tts(self) -> TTSConfig:
        return TTSConfig(
            provider=self.tts_provider,
            api_key=self.tts_api_key,
            voice=self.tts_voice,
            model=self.tts_model,
            base_url=self.tts_base_url,
            language=self.tts_language,
        )
