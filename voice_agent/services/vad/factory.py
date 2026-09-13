"""VAD factory: -> Pipecat VADAnalyzer.

Docs: https://docs.pipecat.ai/api-reference/server/services/vad

Analyzers (``pipecat.audio.vad``): ``SileroVADAnalyzer`` (local, default),
``AICQuailVADAnalyzer`` (license_key, extra ``aic``), ``KrispVivaVadAnalyzer``
(model_path, extra ``krisp``). All take ``VADParams``:
confidence=0.7, start_secs=0.2, stop_secs=0.2, min_volume=0.6.

TODO: add ``VADConfig`` (VAD__PROVIDER, VAD__STOP_SECS ...) and
``match cfg.provider`` like the STT/TTS factories.
"""

from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.audio.vad.vad_analyzer import VADAnalyzer, VADParams


def create_vad(params: VADParams | None = None) -> VADAnalyzer:
    """Build the VAD analyzer; ``None`` params -> Pipecat defaults."""
    return SileroVADAnalyzer(params=params or VADParams())