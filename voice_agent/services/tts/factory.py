"""TTS factory: TTSConfig -> Pipecat TTSService.

Providers: cartesia | deepgram | gemini | groq. Language coverage differs per
provider; check the provider docs before switching for a non-English agent.
"""

from typing import assert_never

# Service
from pipecat.services.cartesia.tts import CartesiaTTSService
from pipecat.services.deepgram.tts import DeepgramTTSService
from pipecat.services.google.tts import GeminiTTSService
from pipecat.services.groq.tts import GroqTTSService
from pipecat.services.tts_service import TTSService
from pipecat.transcriptions.language import Language

from voice_agent.config.defaults import TTS_DEFAULT_MODEL, TTS_DEFAULT_VOICE
from voice_agent.config.providers import TTSProvider
from voice_agent.config.settings import TTSConfig


def create_tts(cfg: TTSConfig) -> TTSService:
    """Build the TTS service for ``cfg.provider``.

    ``match`` is exhaustive over ``TTSProvider``; pyright flags a missing case.
    """
    key = cfg.api_key.get_secret_value() if cfg.api_key else "none"
    language = Language(cfg.language)

    match cfg.provider:
        case TTSProvider.CARTESIA:
            # Cartesia: streaming over WebSocket; voice is a Cartesia voice id
            return CartesiaTTSService(
                api_key=key,
                settings=CartesiaTTSService.Settings(
                    voice=cfg.voice or TTS_DEFAULT_VOICE[cfg.provider],
                    language=language,
                    model=cfg.model or TTS_DEFAULT_MODEL[cfg.provider],
                ),
            )
        case TTSProvider.DEEPGRAM:
            # Deepgram: streaming over WebSocket; voice name encodes model + language
            return DeepgramTTSService(
                api_key=key,
                settings=DeepgramTTSService.Settings(
                    voice=cfg.voice or TTS_DEFAULT_VOICE[cfg.provider],
                    model=cfg.model or TTS_DEFAULT_MODEL[cfg.provider],
                ),
            )
        case TTSProvider.GEMINI:
            # Gemini: HTTP via Google API key; fixed output sample rate
            return GeminiTTSService(
                api_key=key,
                settings=GeminiTTSService.Settings(
                    voice=cfg.voice or TTS_DEFAULT_VOICE[cfg.provider],
                    language=language,
                    model=cfg.model or TTS_DEFAULT_MODEL[cfg.provider],
                ),
            )
        case TTSProvider.GROQ:
            # Groq: HTTP; fixed output sample rate
            return GroqTTSService(
                api_key=key,
                settings=GroqTTSService.Settings(
                    voice=cfg.voice or TTS_DEFAULT_VOICE[cfg.provider],
                    language=language,
                    model=cfg.model or TTS_DEFAULT_MODEL[cfg.provider],
                ),
            )
        case _ as unreachable:
            assert_never(unreachable)