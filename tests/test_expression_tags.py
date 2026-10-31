import unittest

from pipecat.frames.frames import (
    LLMFullResponseEndFrame,
    LLMFullResponseStartFrame,
    LLMTextFrame,
    OutputTransportMessageFrame,
)
from pipecat.tests.utils import run_test

from voice_agent.pipeline.processors.expression_tags import (
    EXPRESSION_MESSAGE_TYPE,
    ExpressionTagParser,
    ExpressionTagProcessor,
    Tag,
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
        if isinstance(f, LLMTextFrame):
            out.append(f.text)
        elif isinstance(f, OutputTransportMessageFrame):
            data = f.message["data"]
            assert f.message["label"] == "rtvi-ai" and f.message["type"] == "server-message"
            assert data["type"] == EXPRESSION_MESSAGE_TYPE
            out.append(f"<{data['expression']}>")
    return out


class ExpressionTagProcessorTest(unittest.IsolatedAsyncioTestCase):
    async def _run(self, *chunks: str):
        frames = [LLMFullResponseStartFrame(), *(LLMTextFrame(text=c) for c in chunks)]
        frames.append(LLMFullResponseEndFrame())
        down, _ = await run_test(ExpressionTagProcessor(), frames_to_send=frames)
        return down

    async def test_tags_become_messages_between_text(self):
        down = await self._run("[", "sad", "] Tôi rất", " tiếc. ", "[neutral] Bạn ổn không?")
        self.assertEqual(
            sequence(down), ["<sad>", "Tôi rất", " tiếc. ", "<neutral>", "Bạn ổn không?"]
        )

    async def test_tag_in_the_middle_of_one_chunk_keeps_position(self):
        down = await self._run("Một. [happy] Hai.")
        self.assertEqual(sequence(down), ["Một. ", "<happy>", "Hai."])

    async def test_no_tag_text_is_left_in_speech(self):
        down = await self._run("[happy] Chào ", "[sad] bạn [excited] nhé")
        spoken = "".join(f.text for f in down if isinstance(f, LLMTextFrame))
        self.assertNotIn("[", spoken)
        self.assertNotIn("]", spoken)

    async def test_start_and_end_frames_pass_through(self):
        down = await self._run("[happy] Chào")
        kinds = [type(f) for f in down]
        self.assertEqual(kinds[0], LLMFullResponseStartFrame)
        self.assertEqual(kinds[-1], LLMFullResponseEndFrame)

    async def test_dangling_bracket_is_not_lost(self):
        down = await self._run("Xin chào [hap")
        self.assertEqual("".join(sequence(down)), "Xin chào [hap")

    async def test_unknown_tag_sends_no_message(self):
        down = await self._run("[excited] Tuyệt!")
        self.assertEqual(sequence(down), ["Tuyệt!"])


if __name__ == "__main__":
    unittest.main()
