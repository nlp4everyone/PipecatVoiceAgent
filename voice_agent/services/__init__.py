"""Service factories: Settings -> Pipecat services.

``build_services`` is the only entry point ``main.py`` needs. Each sub-package
(``stt``, ``tts``, ``llm``, ``vad``) exposes a ``create_x(cfg)`` that maps a
pydantic config onto a Pipecat service via ``match cfg.provider``.
"""

from dataclasses import dataclass
from pipecat.audio.vad.vad_analyzer import VADAnalyzer
from pipecat.services.llm_service import LLMService
from pipecat.services.stt_service import STTService
from pipecat.services.tts_service import TTSService
from voice_agent.config.settings import Settings
from voice_agent.services.llm.factory import create_llm
from voice_agent.services.stt.factory import create_stt
from voice_agent.services.tts.factory import create_tts
from voice_agent.services.vad.factory import create_vad

__all__ = ["Services", "build_services", "create_llm", "create_stt", "create_tts", "create_vad"]


@dataclass
class Services:
    """All services the pipeline needs, built once per session."""

    stt: STTService
    llm: LLMService
    tts: TTSService
    vad: VADAnalyzer
    llm_fallback: LLMService | None = None  # second LLM for LLMSwitcher


def build_services(s: Settings) -> Services:
    """Instantiate every service from ``Settings``.

    Services are created but not yet connected; Pipecat connects them when the
    pipeline starts.
    """
    return Services(
        stt=create_stt(s.stt),
        llm=create_llm(s.llm),
        tts=create_tts(s.tts),
        vad=create_vad(),
        llm_fallback=create_llm(s.llm_fallback) if s.llm_fallback else None,
    )
