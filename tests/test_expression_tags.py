import unittest

from pipecat.frames.frames import (
    AggregatedTextFrame,
    LLMFullResponseEndFrame,
    LLMFullResponseStartFrame,
    LLMTextFrame,
    OutputTransportMessageFrame,
    TTSAudioRawFrame,
    TTSTextFrame,
)
from pipecat.services.tts_service import TTSService
from pipecat.tests.utils import run_test

from voice_agent.pipeline.processors.expression_tags import (
    EXPRESSION_MESSAGE_TYPE,
    ExpressionTagParser,
    Tag,
    attach_expression_tags,
    split_tags,
)


def run(*chunks: str) -> tuple[str, list[str]]:
    """Feed chunks in order, then flush; return all text and all tags."""
    parser = ExpressionTagParser()
    text: list[str] = []
    tags: list[str] = []
    for chunk in chunks:
        for segment in parser.feed(chunk):
            if isinstance(segment, Tag):
                tags.append(segment.name)
            else:
                text.append(segment)
    text.append(parser.flush())
    return "".join(text), tags


class ExpressionTagParserTest(unittest.TestCase):
    def test_leading_tag(self):
        self.assertEqual(run("[happy] Chào bạn!"), ("Chào bạn!", ["happy"]))

    def test_tag_split_across_chunks(self):
        self.assertEqual(run("[", "hap", "py", "] Chào", " bạn"), ("Chào bạn", ["happy"]))

    def test_split_between_every_character(self):
        raw = "[sad] Tôi rất tiếc. [neutral] Bạn cần gì?"
        self.assertEqual(run(*raw), ("Tôi rất tiếc. Bạn cần gì?", ["sad", "neutral"]))

    def test_tag_mid_text_collapses_space(self):
        self.assertEqual(run("Một. [neutral] Hai."), ("Một. Hai.", ["neutral"]))

    def test_tag_is_case_insensitive(self):
        self.assertEqual(run("[Happy] Vui quá"), ("Vui quá", ["happy"]))

    def test_unknown_tag_is_stripped_but_not_reported(self):
        self.assertEqual(run("[excited] Tuyệt!"), ("Tuyệt!", []))

    def test_translated_tag_is_stripped(self):
        self.assertEqual(run("[vui vẻ] Chào bạn"), ("Chào bạn", []))

    def test_no_tag_passes_through(self):
        self.assertEqual(run("Xin chào, bạn khỏe không?"), ("Xin chào, bạn khỏe không?", []))

    def test_non_tag_brackets_are_kept(self):
        self.assertEqual(run("Xem mục [1] và [2.5]."), ("Xem mục [1] và [2.5].", []))

    def test_empty_brackets_are_kept(self):
        self.assertEqual(run("a [] b"), ("a [] b", []))

    def test_unfinished_tag_at_end_is_flushed_as_text(self):
        self.assertEqual(run("Xin chào [hap"), ("Xin chào [hap", []))

    def test_overlong_bracket_is_text(self):
        long = "[" + "a" * 40 + "]"
        self.assertEqual(run(long), (long, []))

    def test_reset_drops_half_tag(self):
        parser = ExpressionTagParser()
        parser.feed("[hap")
        parser.reset()
        self.assertEqual(parser.feed("Chào"), ["Chào"])

    def test_tags_in_one_chunk_keep_order(self):
        self.assertEqual(run("[happy] A [sad] B"), ("A B", ["happy", "sad"]))


class ParserSegmentsTest(unittest.TestCase):
    def test_segments_keep_order(self):
        parser = ExpressionTagParser()
        self.assertEqual(
            parser.feed("[sad] Tiếc quá. [neutral] Bạn ổn không?"),
            [Tag("sad"), "Tiếc quá. ", Tag("neutral"), "Bạn ổn không?"],
        )


def sequence(down) -> list[str]:
    """Frames the TTS would see: text as-is, tags as ``<name>``."""
    out = []
    for f in down:
        if isinstance(f, (LLMTextFrame, AggregatedTextFrame)):
            out.append(f.text)
        elif isinstance(f, OutputTransportMessageFrame):
            data = f.message["data"]
            assert f.message["label"] == "rtvi-ai" and f.message["type"] == "server-message"
            assert data["type"] == EXPRESSION_MESSAGE_TYPE
            out.append(f"<{data['expression']}>")
    return out


class SplitTagsTest(unittest.TestCase):
    def test_strips_and_reports(self):
        self.assertEqual(split_tags("[happy] Chào bạn!"), ("Chào bạn!", ["happy"]))

    def test_unknown_tag_stripped_not_reported(self):
        self.assertEqual(split_tags("[excited] Tuyệt!"), ("Tuyệt!", []))

    def test_no_tag(self):
        self.assertEqual(split_tags("Xin chào."), ("Xin chào.", []))


class FakeTTS:
    """Just the two methods ``attach_expression_tags`` touches."""

    def __init__(self):
        self.pushed = []
        self.transforms = []

    def add_text_transformer(self, fn, aggregation_type="*"):
        self.transforms.append(fn)

    async def push_frame(self, frame, direction=None):
        self.pushed.append(frame)


class AttachExpressionTagsTest(unittest.IsolatedAsyncioTestCase):
    def _spoken(self, cls, text):
        frame = cls(text, "sentence")
        frame.will_be_spoken = True
        return frame

    async def test_speech_text_has_no_tag(self):
        tts = FakeTTS()
        attach_expression_tags(tts)
        self.assertEqual(await tts.transforms[0]("[sad] Tôi buồn.", "sentence"), "Tôi buồn.")

    async def test_message_follows_its_sentence_frame(self):
        tts = FakeTTS()
        attach_expression_tags(tts)
        await tts.push_frame(self._spoken(AggregatedTextFrame, "[sad] Một."))
        await tts.push_frame(self._spoken(AggregatedTextFrame, "[happy] Hai."))
        self.assertEqual(sequence(tts.pushed), ["Một.", "<sad>", "Hai.", "<happy>"])

    async def test_tts_text_frame_is_stripped_without_second_message(self):
        tts = FakeTTS()
        attach_expression_tags(tts)
        await tts.push_frame(self._spoken(TTSTextFrame, "[sad] Một."))
        self.assertEqual(sequence(tts.pushed), ["Một."])

    async def test_unspoken_frame_is_untouched(self):
        tts = FakeTTS()
        attach_expression_tags(tts)
        await tts.push_frame(AggregatedTextFrame("[sad] Một.", "sentence"))
        self.assertEqual(sequence(tts.pushed), ["[sad] Một."])


class SilentTTS(TTSService):
    """A real ``TTSService`` that records what it was asked to say."""

    def __init__(self):
        super().__init__(push_start_frame=True, push_stop_frames=True, sample_rate=16000)
        self.spoken: list[str] = []

    def can_generate_metrics(self) -> bool:
        return False

    async def run_tts(self, text, context_id):
        self.spoken.append(text)
        yield TTSAudioRawFrame(audio=b"\0" * 320, sample_rate=16000, num_channels=1)


class AttachToRealTTSTest(unittest.IsolatedAsyncioTestCase):
    """Guards against a Pipecat upgrade changing how TTS pushes its frames.

    ``attach_expression_tags`` wraps ``push_frame`` on the instance, which only works
    while TTS calls ``self.push_frame``; the fakes above cannot notice if that stops.
    """

    async def test_tags_are_not_spoken_and_each_message_follows_its_sentence(self):
        tts = SilentTTS()
        attach_expression_tags(tts)
        frames = [
            LLMFullResponseStartFrame(),
            LLMTextFrame(text="[sad] Một câu buồn. "),
            LLMTextFrame(text="[happy] Một câu vui."),
            LLMFullResponseEndFrame(),
        ]
        down, _ = await run_test(tts, frames_to_send=frames)

        self.assertEqual(" ".join(tts.spoken).count("["), 0)
        sentences = [
            f.text for f in down if isinstance(f, AggregatedTextFrame) and f.will_be_spoken
        ]
        self.assertTrue(all("[" not in s for s in sentences))
        order = [
            f"<{f.message['data']['expression']}>"
            if isinstance(f, OutputTransportMessageFrame)
            else "audio"
            for f in down
            if isinstance(f, (OutputTransportMessageFrame, TTSAudioRawFrame))
        ]
        self.assertEqual([x for x in order if x != "audio"], ["<sad>", "<happy>"])
        # <sad> comes before the first audio and <happy> falls between the two sentences' audio
        self.assertEqual(order[0], "<sad>")
        self.assertIn("audio", order[order.index("<sad>") : order.index("<happy>")])


if __name__ == "__main__":
    unittest.main()
