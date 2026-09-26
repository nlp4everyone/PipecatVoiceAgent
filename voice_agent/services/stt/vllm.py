"""Speech-to-text against a self-hosted vLLM server (OpenAI-compatible ASR).

``VLLMSTTService``: REST, one request per VAD-bounded utterance, via vLLM's
OpenAI-compatible ``/v1/audio/transcriptions`` endpoint — the same pattern as
pipecat's own ``OpenAISTTService``/``GroqSTTService``.

The actual model served is never hardcoded here; it always comes from
``STTConfig.model`` (``STT_MODEL``).

Serving side (example)::

    vllm serve Qwen/Qwen3-ASR-1.7B --port 8000

then set ``STT_PROVIDER=vllm``, ``STT_MODEL`` to the served model name and
``STT_BASE_URL=http://<host>:8000/v1``. A server started without
``--api-key`` accepts any key, so ``VLLM_API_KEY=EMPTY`` is enough.
"""

from dataclasses import dataclass
from openai.types.audio import Transcription
from pipecat.services.whisper.base_stt import BaseWhisperSTTService

@dataclass
class VLLMSTTSettings(BaseWhisperSTTService.Settings):
    """Settings for the non-streaming vLLM STT service.

    Inherits ``model``, ``language``, ``prompt`` and ``temperature`` from the
    Whisper base; no vLLM-specific fields yet. Kept as its own class so they
    can be added without touching the factory.
    """
    pass


class VLLMSTTService(BaseWhisperSTTService):
    """REST speech-to-text against a self-hosted vLLM server.

    One request per VAD-bounded utterance via vLLM's OpenAI-compatible
    ``/v1/audio/transcriptions`` endpoint. ``base_url`` should point at the
    server's ``/v1`` root (e.g. ``http://localhost:8000/v1``).

    Everything except the request itself is inherited from
    ``BaseWhisperSTTService``: the ``AsyncOpenAI`` client (built from
    ``api_key``/``base_url``), buffering audio until VAD stop, mapping
    ``Language`` to a Whisper code (``Language.VI`` -> ``"vi"``), metrics, and
    turning exceptions into ``ErrorFrame``.
    """

    Settings = VLLMSTTSettings
    # Re-annotated so type checkers see the subclass settings type.
    _settings: Settings

    async def _transcribe(self, audio: bytes) -> Transcription:
        """Send one utterance to vLLM and return its transcription.

        Args:
            audio: One VAD-bounded utterance, already WAV-encoded by the
                segmented base class.

        Returns:
            The OpenAI-style ``Transcription``; the base class only reads
            ``.text`` from it.
        """
        # Default "json" response: nothing downstream uses the segment /
        # probability data that verbose_json would add.
        # ``prompt``/``temperature`` from Settings are not forwarded yet.
        return await self._client.audio.transcriptions.create(
            # The filename extension tells the server how to decode the upload.
            file=("audio.wav", audio, "audio/wav"),
            model=self._settings.model,
            # Already a Whisper code ("vi"), converted by the base STTService.
            language=self._settings.language,
        )
