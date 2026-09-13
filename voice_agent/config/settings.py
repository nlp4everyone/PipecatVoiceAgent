"""Runtime configuration, read from environment / .env.

Nested groups use a double underscore in env names: ``LLM__PROVIDER``,
``STT__API_KEY``, ``TTS__VOICE`` ...  API keys may also be given under the
provider's conventional name (``GROQ_API_KEY``, ``GOOGLE_API_KEY``,
``DEEPGRAM_API_KEY``, ``CARTESIA_API_KEY`` ...), so an existing ``.env`` keeps working.
"""

import os

from pydantic import BaseModel, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from voice_agent.config.prompts import DEFAULT_SYSTEM_INSTRUCTION
from voice_agent.config.providers import (
    LEGACY_KEY_ENV,
    LLMProvider,
    STTProvider,
    TTSProvider,
)


class LLMConfig(BaseModel):
    provider: LLMProvider = LLMProvider.GROQ
    model: str | None = None # Use None for default model
    api_key: SecretStr | None = None
    base_url: str | None = None  # reserved; not used by any current provider
    temperature: float = 0.2
    max_tokens: int = 1024
    system_instruction: str = DEFAULT_SYSTEM_INSTRUCTION


class STTConfig(BaseModel):
    provider: STTProvider = STTProvider.GROQ
    model: str | None = None # Use None for default model
    api_key: SecretStr | None = None
    base_url: str | None = None  # groq only (override the OpenAI-compatible endpoint)
    language: str = "vi"


class TTSConfig(BaseModel):
    provider: TTSProvider = TTSProvider.CARTESIA
    api_key: SecretStr | None = None
    voice: str | None = None  # Use None for provider default voice
    model: str | None = None  # Use None for default model
    base_url: str | None = None  # reserved; not used by any current provider
    language: str = "vi"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_nested_delimiter="__", extra="ignore")

    llm: LLMConfig = LLMConfig()
    llm_fallback: LLMConfig | None = None  # second LLM for LLMSwitcher; unset = no switcher
    stt: STTConfig = STTConfig()
    tts: TTSConfig = TTSConfig()

    turn_profile: str = "webrtc"  # key in config.profiles.PROFILES
    log_level: str = "DEBUG"

    @model_validator(mode="after")
    def _fill_legacy_env(self) -> "Settings":
        for cfg in (self.llm, self.llm_fallback, self.stt, self.tts):
            if cfg is None or cfg.api_key is not None:
                continue
            env = LEGACY_KEY_ENV.get(cfg.provider)
            value = os.getenv(env) if env else None

            if not value:
                raise ValueError(
                    f"Missing API key for {cfg.provider!r}: set the nested env var or {env}"
                )
            cfg.api_key = SecretStr(value)
        # CARTESIA_VOICE_ID is a Cartesia voice UUID; only meaningful for that provider
        if self.tts.provider is TTSProvider.CARTESIA and self.tts.voice is None:
            if voice := os.getenv("CARTESIA_VOICE_ID"):
                self.tts.voice = voice
        return self
