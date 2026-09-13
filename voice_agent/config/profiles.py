"""Turn-taking presets. Pure data; `turns/` turns a profile into Pipecat strategies."""

from dataclasses import dataclass
from typing import Literal


@dataclass(frozen=True)
class TurnProfile:
    # when does the user's turn start?
    start: Literal["vad", "min_words", "wake_phrase", "custom"] = "vad"  # custom: caller passes strategies
    min_words: int = 3
    wake_phrases: tuple[str, ...] = ()
    enable_interruptions: bool = True

    # when does it stop?
    stop: Literal["smart_turn", "speech_timeout"] = "smart_turn"
    speech_timeout: float = 0.6
    turn_stop_timeout: float = 5.0  # safety net: force-close the turn after this

    # when is user input discarded?
    mute: Literal["none", "always", "first_speech", "until_first_complete"] = "none"
    mute_during_function_calls: bool = False

    # let the LLM decide whether the turn is really complete
    filter_incomplete_user_turns: bool = False


PROFILES: dict[str, TurnProfile] = {
    # browser client; user may barge in, greeting is protected
    "webrtc": TurnProfile(mute="always"),
    # phone audio is noisy: need a few words before interrupting, drop overlap
    "telephony": TurnProfile(start="min_words", stop="speech_timeout", mute="always"),
    # public device: only react after a wake phrase
    "kiosk": TurnProfile(start="wake_phrase", wake_phrases=("xin chào bot",)),
    # slot-filling forms: wait until the user has finished the whole answer
    "intake": TurnProfile(filter_incomplete_user_turns=True),
}
