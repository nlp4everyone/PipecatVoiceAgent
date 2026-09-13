"""When is user audio *ignored*? TurnProfile.mute -> Pipecat mute strategies."""

from pipecat.turns.user_mute import (
    AlwaysUserMuteStrategy,
    BaseUserMuteStrategy,
    FirstSpeechUserMuteStrategy,
    FunctionCallUserMuteStrategy,
    MuteUntilFirstBotCompleteUserMuteStrategy,
)

from voice_agent.config.profiles import TurnProfile

# TurnProfile.mute -> strategy class; None = never mute
_MUTE: dict[str, type[BaseUserMuteStrategy] | None] = {
    "none": None,
    "always": AlwaysUserMuteStrategy,
    "first_speech": FirstSpeechUserMuteStrategy,
    "until_first_complete": MuteUntilFirstBotCompleteUserMuteStrategy,
}


def build_mute_strategies(profile: TurnProfile) -> list[BaseUserMuteStrategy]:
    """Build the mute strategies for ``profile``; empty list = never mute.

    Muting drops user frames before they reach the turn logic, so a muted
    user can neither interrupt the bot nor queue up a turn. Strategies
    combine with OR.

    Options (``profile.mute``):
        ``none``: never mute.
        ``always``: mute whenever the bot is speaking — no barge-in at all.
        ``first_speech``: mute only while the bot delivers its first utterance;
            the user may speak before it starts.
        ``until_first_complete``: mute from session start until the bot's first
            utterance completes — the bot fully owns the opening.

    ``profile.mute_during_function_calls`` adds a strategy that mutes while a
    tool call is executing, on top of the option above.
    """
    out: list[BaseUserMuteStrategy] = []
    if cls := _MUTE[profile.mute]:
        out.append(cls())
    if profile.mute_during_function_calls:
        out.append(FunctionCallUserMuteStrategy())
    return out
