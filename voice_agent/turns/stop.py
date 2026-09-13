"""When does a user turn *stop*? TurnProfile.stop -> Pipecat stop strategy."""

from pipecat.turns.user_stop import (
    BaseUserTurnStopStrategy,
    SpeechTimeoutUserTurnStopStrategy,
    TurnAnalyzerUserTurnStopStrategy,
)
from pipecat.audio.turn.smart_turn.local_smart_turn_v3 import LocalSmartTurnAnalyzerV3
from voice_agent.config.profiles import TurnProfile


def build_stop_strategies(profile: TurnProfile) -> list[BaseUserTurnStopStrategy]:
    """Build the single stop strategy for ``profile.stop``.

    Stopping the turn is what sends the transcript to the LLM, so this is the
    agent's main latency-vs-accuracy trade-off: stop too early and the bot
    answers half a sentence; too late and it feels sluggish.

    Options:
        ``smart_turn``: a local end-of-turn model listens to audio + transcript
            and predicts whether the user is done. Handles mid-sentence pauses
            well; costs some CPU.
        ``speech_timeout``: the turn ends ``speech_timeout`` seconds after VAD
            reports silence (plus a short wait for the final transcript).
            Predictable and cheap; cuts off people who pause to think.

    Either way ``TurnProfile.turn_stop_timeout`` (applied in
    ``build_user_turn``) force-closes a turn that never stopped on its own.
    """
    match profile.stop:
        case "smart_turn":
            # local end-of-turn model: decides from audio whether the user is done
            return [TurnAnalyzerUserTurnStopStrategy(turn_analyzer=LocalSmartTurnAnalyzerV3())]
        case "speech_timeout":
            # fixed silence after speech; cheaper, cuts off slow speakers
            return [SpeechTimeoutUserTurnStopStrategy(user_speech_timeout=profile.speech_timeout)]
    raise ValueError(f"Unknown stop strategy: {profile.stop!r}")
