"""Strip ``[happy]``-style expression tags from LLM text before it reaches TTS.

The LLM prefixes sentences with a tag from ``EXPRESSION_TAGS`` (see
``config/prompts.py``). While streaming, a tag can arrive split across chunks
("[", "hap", "py]"), so ``ExpressionTagParser`` buffers a possible tag until it
can tell. ``ExpressionTagProcessor`` is the thin FrameProcessor around it; it
turns each tag into an RTVI server message for the client.
"""

from dataclasses import dataclass

import pipecat.processors.frameworks.rtvi.models as RTVI
from loguru import logger
from pipecat.frames.frames import (
    Frame,
    InterruptionFrame,
    LLMFullResponseEndFrame,
    LLMFullResponseStartFrame,
    LLMTextFrame,
    OutputTransportMessageFrame,
)
from pipecat.processors.frame_processor import FrameDirection, FrameProcessor

from voice_agent.config.prompts import EXPRESSION_TAGS

# `data.type` of the RTVI server message the client listens for.
EXPRESSION_MESSAGE_TYPE = "avatar-expression"

# Longest bracketed run that may still be a tag. Anything longer is plain text.
_MAX_TAG_LEN = 24


def _is_tag_char(ch: str) -> bool:
    return ch.isalpha() or ch in " _-"


@dataclass(frozen=True)
class Tag:
    """A known expression tag found in the stream."""

    name: str


Segment = str | Tag


class ExpressionTagParser:
    """Incremental tag stripper. ``feed`` chunks in order, ``flush`` at the end.

    Any short bracketed word is removed from the text, known or not: a made-up
    tag such as ``[vui]`` must not be read aloud. Only known tags are reported.
    """

    def __init__(self, known: tuple[str, ...] = EXPRESSION_TAGS):
        self._known = frozenset(known)
        self.reset()

    def reset(self) -> None:
        self._pending = ""  # "[" plus what followed it, while undecided
        self._skip_space = False  # drop the space that followed a removed tag

    def feed(self, chunk: str) -> list[Segment]:
        """Return this chunk as ordered segments: text to speak and known tags."""
        segments: list[Segment] = []
        out: list[str] = []

        def close_text() -> None:
            if out:
                segments.append("".join(out))
                out.clear()

        for ch in chunk:
            if self._pending:
                if ch == "]":
                    name = self._pending[1:].strip().lower()
                    self._pending = ""
                    if name:
                        if name in self._known:
                            close_text()
                            segments.append(Tag(name))
                        self._skip_space = True
                    else:
                        out.append("[]")
                elif _is_tag_char(ch) and len(self._pending) < _MAX_TAG_LEN:
                    self._pending += ch
                else:
                    # Not a tag after all: give the buffered text back unchanged.
                    out.append(self._pending)
                    self._pending = ""
                    self._emit(ch, out)
            else:
                self._emit(ch, out)
        close_text()
        return segments

    def flush(self) -> str:
        """End of response: an unfinished "[..." was ordinary text."""
        text, self._pending = self._pending, ""
        return text

    def _emit(self, ch: str, out: list[str]) -> None:
        if ch == "[":
            self._pending = "["
            return
        if self._skip_space and ch == " ":
            self._skip_space = False
            return
        self._skip_space = False
        out.append(ch)


def expression_message(tag: str) -> dict:
    """The RTVI ``server-message`` the client receives for ``tag``."""
    message = RTVI.ServerMessage(data={"type": EXPRESSION_MESSAGE_TYPE, "expression": tag})
    return message.model_dump(exclude_none=True)


class ExpressionTagProcessor(FrameProcessor):
    """Sits between the LLM and TTS: removes tags from text, tells the client.

    Each tag becomes an ``OutputTransportMessageFrame`` placed between the text
    before it and the text after it. It is a non-system frame, so TTS queues it
    in order with the audio instead of letting it overtake: the client gets it
    when the sentence is about to play, not when the LLM wrote it.
    """

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._parser = ExpressionTagParser()

    async def process_frame(self, frame: Frame, direction: FrameDirection):
        await super().process_frame(frame, direction)

        if isinstance(frame, LLMTextFrame):
            reuse = True  # first text segment keeps the original frame
            for segment in self._parser.feed(frame.text):
                if isinstance(segment, Tag):
                    logger.debug(f"Expression tag from LLM: {segment.name}")
                    await self.push_frame(
                        OutputTransportMessageFrame(message=expression_message(segment.name)),
                        direction,
                    )
                elif reuse:
                    frame.text = segment
                    await self.push_frame(frame, direction)
                    reuse = False
                else:
                    extra = LLMTextFrame(text=segment)
                    extra.skip_tts = frame.skip_tts
                    await self.push_frame(extra, direction)
            return

        if isinstance(frame, LLMFullResponseEndFrame):
            rest = self._parser.flush()
            if rest:
                await self.push_frame(LLMTextFrame(text=rest), direction)
        elif isinstance(frame, (LLMFullResponseStartFrame, InterruptionFrame)):
            self._parser.reset()

        await self.push_frame(frame, direction)
