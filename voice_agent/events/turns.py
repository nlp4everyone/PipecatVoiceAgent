"""User turn events from the user aggregator and from start strategies."""

from loguru import logger
from pipecat.turns.user_start import WakePhraseUserTurnStartStrategy

from .context import SessionContext


def register(ctx: SessionContext) -> None:
    user = ctx.user_aggregator

    @user.event_handler("on_user_turn_started")
    async def on_user_turn_started(aggregator, strategy):
        # hot path for barge-in: keep this cheap, no awaits on I/O
        ctx.bump("user_turns")
        logger.debug(f"User turn started via {type(strategy).__name__}")

    @user.event_handler("on_user_turn_stopped")
    async def on_user_turn_stopped(aggregator, strategy, message):
        logger.debug(f"User turn stopped via {type(strategy).__name__}: {message.content!r}")

    @user.event_handler("on_user_turn_stop_timeout")
    async def on_user_turn_stop_timeout(aggregator):
        ctx.bump("turn_stop_timeouts")
        logger.warning("User turn force-closed by user_turn_stop_timeout")

    for strategy in ctx.start_strategies:
        if isinstance(strategy, WakePhraseUserTurnStartStrategy):
            _register_wake_phrase(ctx, strategy)


def _register_wake_phrase(ctx: SessionContext, strategy: WakePhraseUserTurnStartStrategy) -> None:
    @strategy.event_handler("on_wake_phrase_detected")
    async def on_wake_phrase_detected(strategy, phrase: str):
        ctx.bump("wake_phrases")
        logger.info(f"Wake phrase detected: {phrase!r}")

    @strategy.event_handler("on_wake_phrase_timeout")
    async def on_wake_phrase_timeout(strategy):
        logger.info("Wake phrase window timed out; waiting for wake phrase again")
