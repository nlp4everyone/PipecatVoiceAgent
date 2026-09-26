"""STT factory: STTConfig -> Pipecat STTService.

Providers: deepgram | gemini | groq | cartesia | vllm. Most stream over
WebSocket; segmented providers (groq, vllm) upload one utterance after VAD
stop, so latency is higher.
"""

from typing import assert_never

# Service
from pipecat.services.cartesia.stt import CartesiaSTTService
from pipecat.services.deepgram.stt import DeepgramSTTService
from pipecat.services.google.gemini_live.stt import GeminiSTTService
from pipecat.services.groq.stt import GroqSTTService
from pipecat.services.stt_service import STTService
from pipecat.transcriptions.language import Language

from voice_agent.config.defaults import STT_DEFAULT_BASE_URL, STT_DEFAULT_MODEL
from voice_agent.config.providers import STTProvider
from voice_agent.config.settings import STTConfig
from voice_agent.services.stt.vllm import VLLMSTTService


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
                settings=DeepgramSTTService.Settings(model=cfg.model or STT_DEFAULT_MODEL[cfg.provider],
                                                     language=language),
            )
        case STTProvider.GEMINI:
            # Gemini: streaming; takes a list of language hints
            return GeminiSTTService(
                api_key=key,
                settings=GeminiSTTService.Settings(model=cfg.model or STT_DEFAULT_MODEL[cfg.provider],
                                                   languages=[language]),
            )
        case STTProvider.GROQ:
            # Groq: segmented; OpenAI-compatible transcription endpoint
            return GroqSTTService(
                api_key=key,
                base_url=cfg.base_url or STT_DEFAULT_BASE_URL[cfg.provider],
                settings=GroqSTTService.Settings(model=cfg.model or STT_DEFAULT_MODEL[cfg.provider],
                                                 language=language),
            )
        case STTProvider.CARTESIA:
            # Cartesia: streaming over WebSocket
            return CartesiaSTTService(
                api_key=key,
                settings=CartesiaSTTService.Settings(model=cfg.model or STT_DEFAULT_MODEL[cfg.provider],
                                                     language=language),
            )
        case STTProvider.VLLM:
            # Self-hosted vLLM: segmented; OpenAI-compatible transcription endpoint
            return VLLMSTTService(
                api_key=key,
                base_url=cfg.base_url or STT_DEFAULT_BASE_URL[cfg.provider],
                settings=VLLMSTTService.Settings(model=cfg.model or STT_DEFAULT_MODEL[cfg.provider],
                                                 language=language),
            )
        case _ as unreachable:
            assert_never(unreachable)