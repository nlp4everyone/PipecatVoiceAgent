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

from voice_agent.config.providers import TTSProvider
from voice_agent.config.settings import TTSConfig

# Model — used when ``cfg.model`` is None
CARTESIA_DEFAULT_MODEL = "sonic-3.5"
DEEPGRAM_DEFAULT_MODEL = None  # model is implied by the voice name
GEMINI_DEFAULT_MODEL = "gemini-3.1-flash-tts-preview"
GROQ_DEFAULT_MODEL = "canopylabs/orpheus-v1-english"

# Voice — used when ``cfg.voice`` is None
CARTESIA_DEFAULT_VOICE = "86e30c1d-714b-4074-a1f2-1cb6b552fb49"
DEEPGRAM_DEFAULT_VOICE = "aura-2-helena-en"  # Deepgram TTS: English only
GEMINI_DEFAULT_VOICE = "Zephyr"
GROQ_DEFAULT_VOICE = "autumn"  # Groq TTS: English only


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
                    voice=cfg.voice or CARTESIA_DEFAULT_VOICE,
                    language=language,
                    model=cfg.model or CARTESIA_DEFAULT_MODEL,
                ),
            )
        case TTSProvider.DEEPGRAM:
            # Deepgram: streaming over WebSocket; voice name encodes model + language
            return DeepgramTTSService(
                api_key=key,
                settings=DeepgramTTSService.Settings(
                    voice=cfg.voice or DEEPGRAM_DEFAULT_VOICE,
                    model=cfg.model or DEEPGRAM_DEFAULT_MODEL,
                ),
            )
        case TTSProvider.GEMINI:
            # Gemini: HTTP via Google API key; fixed output sample rate
            return GeminiTTSService(
                api_key=key,
                settings=GeminiTTSService.Settings(
                    voice=cfg.voice or GEMINI_DEFAULT_VOICE,
                    language=language,
                    model=cfg.model or GEMINI_DEFAULT_MODEL,
                ),
            )
        case TTSProvider.GROQ:
            # Groq: HTTP; fixed output sample rate
            return GroqTTSService(
                api_key=key,
                settings=GroqTTSService.Settings(
                    voice=cfg.voice or GROQ_DEFAULT_VOICE,
                    language=language,
                    model=cfg.model or GROQ_DEFAULT_MODEL,
                ),
            )
        case _ as unreachable:
            assert_never(unreachable)