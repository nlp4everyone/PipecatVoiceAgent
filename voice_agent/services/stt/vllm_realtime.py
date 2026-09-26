"""Streaming speech-to-text against a self-hosted vLLM server (Realtime API).

``VLLMRealtimeSTTService``: WebSocket, one generation per VAD-bounded
utterance, via vLLM's ``/v1/realtime`` endpoint. Modeled on pipecat's
``OpenAIRealtimeSTTService``, but vLLM's protocol differs, so this subclasses
``WebsocketSTTService`` directly instead of the OpenAI class:

====================  =====================================  ==============================
                      OpenAI Realtime                        vLLM ``/v1/realtime``
====================  =====================================  ==============================
``session.update``    nested ``session.audio.input...``      flat ``{"model": ...}`` only
audio                 PCM16 24 kHz                           PCM16 16 kHz mono
one utterance         append ..., ``commit`` at VAD stop     ``commit`` starts, append ...,
                                                             ``commit`` + ``final`` ends
results               ``conversation.item.input_audio_``     ``transcription.delta`` /
                      ``transcription.delta/.completed``     ``transcription.done``
====================  =====================================  ==============================

Serving side (example)::

    vllm serve mistralai/Voxtral-Mini-4B-Realtime-2602 --enforce-eager

then set ``STT_PROVIDER=vllm_realtime``, ``STT_MODEL`` to the served model and
``STT_BASE_URL=ws://<host>:8000/v1/realtime``. vLLM's realtime session has no
language field — the model detects the language itself.

Qwen3-ASR also runs on this endpoint but transcribes in isolated 5 s windows
(vllm-project/vllm#35767); prefer ``VLLMSTTService`` (REST) for it.
"""

import asyncio
import base64
import json
import re
from collections.abc import AsyncGenerator
from typing import Any

from loguru import logger
from websockets.asyncio.client import connect as websocket_connect
from websockets.protocol import State

from pipecat.audio.utils import create_stream_resampler
from pipecat.frames.frames import (
    Frame,
    InterimTranscriptionFrame,
    TranscriptionFrame,
    VADUserStartedSpeakingFrame,
    VADUserStoppedSpeakingFrame,
)
from pipecat.processors.frame_processor import FrameDirection, FrameProcessorSetup
from pipecat.services.settings import STTSettings
from pipecat.services.stt_latency import DEFAULT_TTFS_P99
from pipecat.services.stt_service import WebsocketSTTService
from pipecat.utils.time import time_now_iso8601

# vLLM's realtime endpoint only accepts 16 kHz mono PCM16.
VLLM_REALTIME_SAMPLE_RATE = 16000

# Qwen3-ASR on /v1/realtime leaks its raw output prefix ("language Vietnamese<asr_text>")
# into the text (vllm-project/vllm#35767); strip it so it never reaches the LLM.
_QWEN_ASR_PREFIX = re.compile(r"language\s+[^<]*<asr_text>")


class VLLMRealtimeSTTService(WebsocketSTTService):
    """Streaming speech-to-text against a self-hosted vLLM ``/v1/realtime`` server.

    Needs local VAD in the pipeline (vLLM has no server-side VAD). Per utterance:

    1. ``VADUserStartedSpeakingFrame`` -> ``input_audio_buffer.commit`` starts a
       generation, then the pre-roll buffer is flushed so the speech onset VAD
       detected late is not lost.
    2. While speaking, each audio chunk -> ``input_audio_buffer.append``.
    3. ``VADUserStoppedSpeakingFrame`` -> ``commit`` with ``final: true``.
    4. ``transcription.delta`` -> ``InterimTranscriptionFrame`` (accumulated
       text); ``transcription.done`` -> ``TranscriptionFrame``.

    Audio outside an utterance is kept in a short local pre-roll instead of
    being streamed: vLLM queues everything appended, so streaming silence would
    make the next utterance transcribe it too.

    An open generation holds KV cache on the server until ``final`` arrives or
    the socket closes (vllm-project/vllm#46815), so every path that ends an
    utterance — VAD stop, disconnect, stop/cancel — sends ``final``.
    """

    Settings = STTSettings
    _settings: Settings

    def __init__(
        self,
        *,
        api_key: str,
        base_url: str = "ws://localhost:8000/v1/realtime",
        pre_roll_secs: float = 0.5,
        done_timeout_secs: float = 10.0,
        settings: Settings | None = None,
        ttfs_p99_latency: float | None = DEFAULT_TTFS_P99,
        **kwargs,
    ):
        """Initialize the vLLM Realtime STT service.

        Args:
            api_key: Sent as ``Authorization: Bearer``; any value works for a
                server started without ``--api-key`` (e.g. ``"EMPTY"``).
            base_url: WebSocket URL of the realtime endpoint.
            pre_roll_secs: Audio kept from before VAD start and sent right after
                the start ``commit``, covering VAD's detection delay.
            done_timeout_secs: How long to wait for ``transcription.done`` after
                ``final`` before giving up on that utterance, so a lost reply
                can't block every later one.
            settings: ``model`` is sent in ``session.update``; ``language`` is
                accepted for interface parity but vLLM ignores it.
            ttfs_p99_latency: P99 speech-end -> final-transcript latency in
                seconds; measure it for your deployment.
            **kwargs: Passed to ``WebsocketSTTService``.
        """
        default_settings = self.Settings(model=None, language=None)
        if settings is not None:
            default_settings.apply_update(settings)

        super().__init__(ttfs_p99_latency=ttfs_p99_latency, settings=default_settings, **kwargs)

        self._api_key = api_key
        self._base_url = base_url
        self._pre_roll_secs = pre_roll_secs
        self._done_timeout_secs = done_timeout_secs

        self._resampler = create_stream_resampler()
        self._receive_task: asyncio.Task | None = None
        self._done_timeout_task: asyncio.Task | None = None

        # 16 kHz PCM not yet sent: pre-roll while idle, backlog while a start is queued.
        self._audio_buffer = bytearray()
        self._pre_roll_bytes = int(pre_roll_secs * VLLM_REALTIME_SAMPLE_RATE) * 2
        self._interim_text = ""

        # Utterance state machine (see class docstring):
        self._session_ready = False  # session.update sent on this socket
        self._speaking = False  # between local VAD start and stop
        self._open = False  # start commit sent, final not yet sent -> stream audio
        self._generating = False  # start commit sent, transcription.done not yet received
        self._start_queued = False  # VAD started while not ready / previous still generating

    def can_generate_metrics(self) -> bool:
        """Whether this service generates processing metrics."""
        return True

    async def _update_settings(self, delta: STTSettings) -> dict[str, Any]:
        """Apply a settings delta; a model change is re-sent to the server."""
        changed = await super()._update_settings(delta)
        if "model" in changed and self._session_ready:
            await self._send_session_update()
        return changed

    async def setup(self, setup: FrameProcessorSetup):
        """Set up the service and connect."""
        await super().setup(setup)
        await self._connect()

    async def run_stt(self, audio: bytes) -> AsyncGenerator[Frame | None, None]:
        """Stream audio during an utterance, otherwise keep it as pre-roll.

        Results arrive asynchronously via the receive task.

        Args:
            audio: 16-bit mono PCM at the pipeline sample rate; resampled to
                16 kHz here.
        """
        audio = await self._resampler.resample(audio, self.sample_rate, VLLM_REALTIME_SAMPLE_RATE)
        if audio:
            if self._open:
                await self._send_audio(audio)
            else:
                self._audio_buffer += audio
                # Idle: keep only the tail. A queued start keeps its whole backlog.
                if not self._speaking and not self._start_queued:
                    del self._audio_buffer[: -self._pre_roll_bytes or None]
        yield None

    async def process_frame(self, frame: Frame, direction: FrameDirection):
        """Map local VAD events to vLLM's start/final commits."""
        await super().process_frame(frame, direction)

        if isinstance(frame, VADUserStartedSpeakingFrame):
            self._speaking = True
            if self._session_ready and not self._generating:
                await self._start_utterance()
            else:
                # Starts once session.created / transcription.done arrives;
                # audio keeps accumulating in the backlog meanwhile.
                self._start_queued = True
        elif isinstance(frame, VADUserStoppedSpeakingFrame):
            self._speaking = False
            if self._open:
                await self._finish_utterance()

    # ------------------------------------------------------------------
    # WebSocket connection management
    # ------------------------------------------------------------------

    async def _connect(self):
        """Connect to the realtime endpoint and start receiving."""
        await super()._connect()
        await self._connect_websocket()
        if self._websocket and not self._receive_task:
            self._receive_task = self.create_task(self._receive_task_handler(self._report_error))

    async def _disconnect(self):
        """Finish any open utterance, then disconnect and clean up tasks."""
        # Release the server's KV cache explicitly rather than relying on close.
        if self._open:
            await self._finish_utterance()
        await super()._disconnect()
        await self._cancel_done_timeout()
        if self._receive_task:
            await self.cancel_task(self._receive_task, timeout=1.0)
            self._receive_task = None
        await self._disconnect_websocket()

    async def _connect_websocket(self):
        """Open the WebSocket; ``session.update`` follows ``session.created``."""
        try:
            if self._websocket and self._websocket.state is State.OPEN:
                return
            # A new socket is a new server session: nothing from the old one survives.
            self._reset_utterance_state()
            self._websocket = await self._websocket_connect(
                uri=self._base_url,
                additional_headers={"Authorization": f"Bearer {self._api_key}"},
            )
            await self._call_event_handler("on_connected")
        except Exception as e:
            await self.push_error(error_msg=f"Error connecting to vLLM Realtime STT: {e}", exception=e)
            self._websocket = None

    async def _disconnect_websocket(self):
        """Close the WebSocket connection."""
        try:
            self._session_ready = False
            if self._websocket:
                await self._websocket.close()
        except Exception as e:
            await self.push_error(error_msg=f"Error disconnecting: {e}", exception=e)
        finally:
            self._websocket = None
            await self._call_event_handler("on_disconnected")

    async def _send_keepalive(self, silence: bytes):
        """Ping instead of raw silence, which vLLM would reject as a non-JSON event."""
        if self._websocket is not None:
            await self._websocket.ping()

    async def _ws_send(self, message: dict):
        """Send a JSON event; errors are reported, not raised."""
        try:
            if not self._disconnecting and self._websocket:
                await self._websocket.send(json.dumps(message))
        except Exception as e:
            if self._disconnecting or not self._websocket:
                return
            await self.push_error(error_msg=f"Error sending message: {e}", exception=e)

    # ------------------------------------------------------------------
    # Client events
    # ------------------------------------------------------------------

    async def _send_session_update(self):
        """Select (and let the server validate) the model; there is no reply."""
        await self._ws_send({"type": "session.update", "model": self._settings.model})

    async def _send_audio(self, audio: bytes):
        """Send 16 kHz PCM16 via ``input_audio_buffer.append``."""
        payload = base64.b64encode(audio).decode("utf-8")
        await self._ws_send({"type": "input_audio_buffer.append", "audio": payload})

    async def _start_utterance(self):
        """Start a generation and flush the pre-roll / backlog into it."""
        self._start_queued = False
        self._open = True
        self._generating = True
        self._interim_text = ""
        await self._ws_send({"type": "input_audio_buffer.commit"})
        if self._audio_buffer:
            await self._send_audio(bytes(self._audio_buffer))
            self._audio_buffer.clear()

    async def _finish_utterance(self):
        """Signal end of audio; the server then sends ``transcription.done``."""
        self._open = False
        await self._ws_send({"type": "input_audio_buffer.commit", "final": True})
        await self._cancel_done_timeout()
        self._done_timeout_task = self.create_task(self._done_timeout_handler())

    async def _done_timeout_handler(self):
        """Give up on a ``transcription.done`` that never came."""
        await asyncio.sleep(self._done_timeout_secs)
        self._done_timeout_task = None
        logger.warning(f"{self}: no transcription.done within {self._done_timeout_secs}s")
        await self._end_generation()

    async def _cancel_done_timeout(self):
        if self._done_timeout_task:
            await self.cancel_task(self._done_timeout_task)
            self._done_timeout_task = None

    async def _end_generation(self):
        """Mark the server idle and start an utterance that queued behind it."""
        self._generating = False
        if self._start_queued and self._session_ready:
            await self._start_utterance()
            # The user may already have stopped while it was queued.
            if not self._speaking:
                await self._finish_utterance()

    def _reset_utterance_state(self):
        self._session_ready = False
        self._open = False
        self._generating = False
        # Speech in progress restarts on the new session.
        self._start_queued = self._speaking
        self._interim_text = ""

    # ------------------------------------------------------------------
    # Server events
    # ------------------------------------------------------------------

    async def _receive_messages(self):
        """Receive and dispatch server events.

        Called by ``WebsocketService._receive_task_handler``, which reconnects
        on connection errors.
        """
        assert self._websocket is not None
        async for message in self._websocket:
            try:
                evt = json.loads(message)
            except json.JSONDecodeError:
                logger.warning("Failed to parse WebSocket message")
                continue

            match evt.get("type", ""):
                case "session.created":
                    await self._handle_session_created(evt)
                case "transcription.delta":
                    await self._handle_transcription_delta(evt)
                case "transcription.done":
                    await self._handle_transcription_done(evt)
                case "error":
                    await self._handle_error(evt)
                case other:
                    logger.trace(f"Unhandled event: {other}")

    async def _handle_session_created(self, evt: dict):
        """Configure the session, then run any utterance that started before it."""
        await self._send_session_update()
        self._session_ready = True
        if self._start_queued and not self._generating:
            await self._start_utterance()
            if not self._speaking:
                await self._finish_utterance()

    async def _handle_transcription_delta(self, evt: dict):
        """Push the text so far; each delta only carries the new piece."""
        delta = evt.get("delta", "")
        if not delta:
            return
        self._interim_text += delta
        text = _clean(self._interim_text)
        if text:
            await self.push_frame(
                InterimTranscriptionFrame(text, self._user_id, time_now_iso8601(), result=evt)
            )

    async def _handle_transcription_done(self, evt: dict):
        """Push the final transcript for the utterance."""
        await self._cancel_done_timeout()
        self._interim_text = ""
        text = _clean(evt.get("text", ""))
        if text:
            # Usage before the frame so tracing attaches it to the span it closes.
            await self.emit_stt_usage_metrics()
            await self.push_frame(
                TranscriptionFrame(text, self._user_id, time_now_iso8601(), result=evt, finalized=True)
            )
        else:
            logger.debug("Received empty transcription from vLLM")
        await self._end_generation()

    async def _handle_error(self, evt: dict):
        """Report a server error; the session stays usable for later utterances.

        vLLM errors (bad event, unvalidated model, ...) don't close the socket,
        so unlike OpenAI's fatal ``error`` this does not raise into a reconnect.
        """
        msg = f"vLLM Realtime STT error [{evt.get('code', '')}]: {evt.get('error', 'Unknown error')}"
        await self.push_error(error_msg=msg)
        # Whatever generation was running is gone; don't let it block the next one.
        if self._open:
            await self._finish_utterance()
        await self._cancel_done_timeout()
        await self._end_generation()


def _clean(text: str) -> str:
    return _QWEN_ASR_PREFIX.sub("", text).strip()
