"""Glue: TurnProfile -> LLMUserAggregatorParams for the pipeline."""

from dataclasses import dataclass

from pipecat.audio.vad.vad_analyzer import VADAnalyzer
from pipecat.processors.aggregators.llm_response_universal import LLMUserAggregatorParams
from pipecat.turns.user_start import BaseUserTurnStartStrategy
from pipecat.turns.user_turn_strategies import UserTurnStrategies

from voice_agent.config.profiles import TurnProfile

from .mute import build_mute_strategies
from .start import build_start_strategies
from .stop import build_stop_strategies


@dataclass(frozen=True)
class UserTurnSetup:
    """Result of ``build_user_turn``.

    Attributes:
        params: Pass to ``builder.build_aggregators``.
        start_strategies: The very same objects wired into ``params``. Pipecat
            event handlers bind to instances, so ``events/turns.py`` needs these
            to subscribe to e.g. ``on_wake_phrase_detected``.
    """

    params: LLMUserAggregatorParams
    start_strategies: list[BaseUserTurnStartStrategy]


def build_user_turn(
    profile: TurnProfile,
    vad: VADAnalyzer,
    start: list[BaseUserTurnStartStrategy] | None = None,
) -> UserTurnSetup:
    """Turn a ``TurnProfile`` into the user-turn setup for one session.

    A user turn is the span between "the user started talking, bot should
    listen" and "the user is done, LLM should answer". Three independent
    policies decide it: start (``build_start_strategies``), stop
    (``build_stop_strategies``) and mute (``build_mute_strategies``). This
    function wires them, plus two safety nets from the profile:
    ``turn_stop_timeout`` force-closes a turn the stop strategy never ended,
    and ``filter_incomplete_user_turns`` lets the LLM veto a turn that looks
    unfinished (useful for slot-filling forms).

    Args:
        profile: Which start / stop / mute policies to use and their knobs.
        vad: Shared VAD analyzer; several strategies listen to its events.
        start: Explicit start strategies. Skips ``build_start_strategies`` —
            use it when ``profile.start == "custom"`` or in tests.
    """
    start_strategies = start if start is not None else build_start_strategies(profile)
    params = LLMUserAggregatorParams(
        vad_analyzer=vad,
        user_turn_strategies=UserTurnStrategies(
            start=start_strategies,
            stop=build_stop_strategies(profile),
        ),
        user_mute_strategies=build_mute_strategies(profile),
        user_turn_stop_timeout=profile.turn_stop_timeout,
        filter_incomplete_user_turns=profile.filter_incomplete_user_turns,
    )
    return UserTurnSetup(params=params, start_strategies=start_strategies)
