"""Observe barge-in. Interruption *policy* lives in `turns/`; this only reacts."""

from loguru import logger

from .context import SessionContext


def register(ctx: SessionContext) -> None:
    @ctx.assistant_aggregator.event_handler("on_assistant_turn_stopped")
    async def on_assistant_turn_stopped(aggregator, message):
        if getattr(message, "interrupted", False):
            n = ctx.bump("interruptions")
            logger.info(f"Bot interrupted (#{n}) after saying: {message.content!r}")
