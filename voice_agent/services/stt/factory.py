"""STT factory: STTConfig -> Pipecat STTService.

Providers: deepgram | gemini | groq | cartesia. Most stream over WebSocket;
segmented providers upload one utterance after VAD stop, so latency is higher.
"""

from typing import assert_never

# Service
from pipecat.services.cartesia.stt import CartesiaSTTService
from pipecat.services.deepgram.stt import DeepgramSTTService
from pipecat.services.google.gemini_live.stt import GeminiSTTService
from pipecat.services.groq.stt import GroqSTTService
from pipecat.services.stt_service import STTService
from pipecat.transcriptions.language import Language

from voice_agent.config.providers import STTProvider
from voice_agent.config.settings import STTConfig

# Model — used when ``cfg.model`` is None
DEEPGRAM_DEFAULT_MODEL = "nova-3"
GEMINI_DEFAULT_MODEL = "gemini-3.5-transcribe-live"
GROQ_DEFAULT_MODEL = "whisper-large-v3-turbo"
CARTESIA_DEFAULT_MODEL = "ink-whisper"
GROQ_BASE_URL = "https://api.groq.com/openai/v1"

def create_stt(cfg: STTConfig) -> STTService:
    """Build the STT service for ``cfg.provider``.

    ``cfg.language`` is a ``Language`` code (e.g. ``"vi"``); Pipecat converts it
    to each provider's own code.

    ``match`` is exhaustive over ``STTProvider``; pyright flags a missing case.
    """
    key = cfg.api_key.get_secret_value() if cfg.api_key else "none"
    language = Language(cfg.language)

    match cfg.provider:
        case STTProvider.DEEPGRAM:
            # Deepgram: streaming over WebSocket
            return DeepgramSTTService(
                api_key=key,
                settings=DeepgramSTTService.Settings(model=cfg.model or DEEPGRAM_DEFAULT_MODEL,
                                                     language=language),
            )
        case STTProvider.GEMINI:
            # Gemini: streaming; takes a list of language hints
            return GeminiSTTService(
                api_key=key,
                settings=GeminiSTTService.Settings(model=cfg.model or GEMINI_DEFAULT_MODEL,
                                                   languages=[language]),
            )
        case STTProvider.GROQ:
            # Groq: segmented; OpenAI-compatible transcription endpoint
            return GroqSTTService(
                api_key=key,
                base_url=cfg.base_url or GROQ_BASE_URL,
                settings=GroqSTTService.Settings(model=cfg.model or GROQ_DEFAULT_MODEL,
                                                 language=language),
            )
        case STTProvider.CARTESIA:
            # Cartesia: streaming over WebSocket
            return CartesiaSTTService(
                api_key=key,
                settings=CartesiaSTTService.Settings(model=cfg.model or CARTESIA_DEFAULT_MODEL,
                                                     language=language),
            )
        case _ as unreachable:
            assert_never(unreachable)