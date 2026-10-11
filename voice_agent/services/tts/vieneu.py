"""Text-to-speech against a self-hosted VieNeu-TTS server (OpenAI-compatible).

``VieNeuTTSService``: HTTP, one streamed request per sentence, via VieNeu's
OpenAI-compatible ``/v1/audio/speech`` endpoint. Raw PCM16 mono chunks are
pushed downstream as they arrive.

Pipecat's ``OpenAITTSService`` is not reused because it only accepts OpenAI's
fixed voice list and a fixed 24 kHz output; VieNeu voices are Vietnamese preset
names (``GET /v1/voices``) and the server can render at the pipeline rate.

Server-side request fields (``GET /openapi.json``, ``SpeechRequest``):

======================  ==========================================================
``model``               ``vieneu-v3-turbo``
``voice``               preset name, e.g. ``"Mai Anh"``; unknown -> HTTP 400
``response_format``     ``pcm`` | ``wav`` (``pcm`` here)
``sample_rate``         48000 | 24000 | 16000 | 8000; anything else -> HTTP 400
``temperature`` ...     sampling: ``temperature``, ``top_k``, ``top_p``,
                        ``repetition_penalty``; ``max_chars`` per internal chunk
``speed``,              accepted for OpenAI compatibility but have no effect
``instructions``        on the audio, so they are not exposed here
======================  ==========================================================

Serving side runs outside this repo; set ``TTS_PROVIDER=vieneu``,
``TTS_BASE_URL=http://<host>:8001/v1`` and ``TTS_VOICE`` to a preset name. A
server without auth accepts any key, so ``VIENEU_API_KEY=EMPTY`` is enough.
"""

from collections.abc import AsyncGenerator
from dataclasses import dataclass, field
from typing import Any

from loguru import logger
from openai import AsyncOpenAI, OpenAIError

from pipecat.frames.frames import ErrorFrame, Frame, StartFrame, TTSAudioRawFrame
from pipecat.services.settings import TTSSettings
from pipecat.services.tts_service import TTSService
from pipecat.utils.tracing.service_decorators import traced_tts
from pipecat.utils.types import NOT_GIVEN, NotGiven, assert_given

# Output rates the server can render; the request asks for the pipeline rate.
VIENEU_SAMPLE_RATES = (48000, 24000, 16000, 8000)


@dataclass
class VieNeuTTSSettings(TTSSettings):
    """Runtime-updatable settings for VieNeu-TTS.

    Sampling fields left as ``None`` are not sent, so the server's own
    defaults apply (temperature 0.8, top_k 25, top_p 0.95,
    repetition_penalty 1.2, max_chars 256).
    """

    temperature: float | None | NotGiven = field(default_factory=lambda: NOT_GIVEN)
    top_k: int | None | NotGiven = field(default_factory=lambda: NOT_GIVEN)
    top_p: float | None | NotGiven = field(default_factory=lambda: NOT_GIVEN)
    repetition_penalty: float | None | NotGiven = field(default_factory=lambda: NOT_GIVEN)
    max_chars: int | None | NotGiven = field(default_factory=lambda: NOT_GIVEN)


class VieNeuTTSService(TTSService):
    """Streaming text-to-speech against a self-hosted VieNeu-TTS server.

    ``base_url`` should point at the server's ``/v1`` root (e.g.
    ``http://localhost:8001/v1``). Audio is requested at the pipeline's output
    sample rate, so no resampling happens on this side.
    """

    Settings = VieNeuTTSSettings
    # Re-annotated so type checkers see the subclass settings type.
    _settings: Settings

    def __init__(
        self,
        *,
        api_key: str,
        base_url: str = "http://localhost:8001/v1",
        settings: Settings | None = None,
        **kwargs,
    ):
        """Initialize the VieNeu TTS service.

        Args:
            api_key: Sent as ``Authorization: Bearer``; any value works for a
                server without auth (e.g. ``"EMPTY"``).
            base_url: The server's OpenAI-compatible ``/v1`` root.
            settings: ``model`` / ``voice`` and optional sampling fields.
            **kwargs: Passed to ``TTSService`` (e.g. ``sample_rate``).
        """
        default_settings = self.Settings(
            model="vieneu-v3-turbo",
            voice="Mai Anh",
            language=None,  # Vietnamese only; the server has no language field
            temperature=None,
            top_k=None,
            top_p=None,
            repetition_penalty=None,
            max_chars=None,
        )
        if settings is not None:
            default_settings.apply_update(settings)

        super().__init__(
            push_start_frame=True,
            push_stop_frames=True,
            settings=default_settings,
            **kwargs,
        )

        self._client = AsyncOpenAI(api_key=api_key, base_url=base_url)

    def can_generate_metrics(self) -> bool:
        """Whether this service generates processing metrics."""
        return True

    async def start(self, frame: StartFrame):
        """Start the service; warn early if the server can't render this rate."""
        await super().start(frame)
        if self.sample_rate not in VIENEU_SAMPLE_RATES:
            logger.warning(
                f"{self}: VieNeu-TTS only renders {VIENEU_SAMPLE_RATES} Hz; "
                f"pipeline output rate {self.sample_rate} Hz will be rejected"
            )

    def _sampling_params(self) -> dict[str, Any]:
        """Sampling fields that are set; the rest keep the server defaults."""
        s = self._settings
        params = {
            "temperature": s.temperature,
            "top_k": s.top_k,
            "top_p": s.top_p,
            "repetition_penalty": s.repetition_penalty,
            "max_chars": s.max_chars,
        }
        return {k: v for k, v in params.items() if v is not None}

    @traced_tts
    async def run_tts(self, text: str, context_id: str) -> AsyncGenerator[Frame, None]:
        """Stream speech for one piece of text.

        Args:
            text: Text to synthesize.
            context_id: Context ID attached to every audio frame.

        Yields:
            ``TTSAudioRawFrame`` chunks, or an ``ErrorFrame`` on failure.
        """
        model = assert_given(self._settings.model)
        voice = assert_given(self._settings.voice)
        if not model or not voice:
            yield ErrorFrame(error="VieNeu TTS model and voice must be specified")
            return
        try:
            async with self._client.audio.speech.with_streaming_response.create(
                model=model,
                input=text,
                voice=voice,
                response_format="pcm",
                # Not part of the OpenAI signature; sent as extra JSON fields.
                extra_body={"sample_rate": self.sample_rate, **self._sampling_params()},
            ) as r:
                await self.start_tts_usage_metrics(text)
                async for chunk in r.iter_bytes(self.chunk_size):
                    if chunk:
                        await self.stop_ttfb_metrics()
                        yield TTSAudioRawFrame(chunk, self.sample_rate, 1, context_id=context_id)
        except OpenAIError as e:
            # Non-2xx (unknown voice, bad sample rate, ...) raises APIStatusError here.
            logger.error(f"{self} error getting audio: {e}")
            yield ErrorFrame(error=f"VieNeu TTS error: {e}")
