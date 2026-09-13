"""When does a user turn *start*? TurnProfile.start -> Pipecat start strategies."""

from pipecat.turns.user_start import (
    BaseUserTurnStartStrategy,
    MinWordsUserTurnStartStrategy,
    TranscriptionUserTurnStartStrategy,
    VADUserTurnStartStrategy,
    WakePhraseUserTurnStartStrategy,
)

from voice_agent.config.profiles import TurnProfile

def build_start_strategies(profile: TurnProfile) -> list[BaseUserTurnStartStrategy]:
    """Build the ordered list of start strategies for ``profile.start``.

    Starting a turn has two effects: the bot stops talking (barge-in) and the
    aggregator begins collecting the user's transcript. Pipecat evaluates the
    returned strategies in order; the turn starts as soon as one fires.

    Options:
        ``vad``: speech energy alone starts the turn — fastest barge-in.
            ``enable_interruptions=False`` keeps VAD for turn-taking but never
            cuts the bot off.
        ``min_words``: while the bot is speaking, require ``min_words``
            transcribed words before interrupting; one word is enough when the
            bot is silent. Filters coughs and background chatter.
        ``wake_phrase``: nothing starts a turn until one of ``wake_phrases`` is
            heard; afterwards VAD / transcription behave as in ``vad``.
        ``custom``: returns ``[]`` on purpose — the caller passes its own list
            to ``build_user_turn(start=...)``. Beware Pipecat treats an empty
            list as "use defaults" (VAD + transcription), not "never start".

    ``TranscriptionUserTurnStartStrategy`` is appended as a fallback: if VAD
    misses quiet speech but STT still returns text, the turn starts anyway.
    """
    match profile.start:
        case "vad":
            return [
                VADUserTurnStartStrategy(enable_interruptions=profile.enable_interruptions),
                TranscriptionUserTurnStartStrategy(),  # fallback when VAD misses
            ]
        case "min_words":
            # noisy audio: wait for a few transcribed words before interrupting
            return [MinWordsUserTurnStartStrategy(min_words=profile.min_words)]
        case "wake_phrase":
            # wake phrase gates the first turn; VAD/transcription drive the rest
            return [
                WakePhraseUserTurnStartStrategy(phrases=list(profile.wake_phrases)),
                VADUserTurnStartStrategy(enable_interruptions=profile.enable_interruptions),
                TranscriptionUserTurnStartStrategy(),
            ]
        case "custom":
            return []  # supplied by the caller
    raise ValueError(f"Unknown start strategy: {profile.start!r}")
