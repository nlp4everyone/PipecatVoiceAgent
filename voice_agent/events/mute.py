"""User mute state changes (any mute strategy)."""

from loguru import logger

from .context import SessionContext


def register(ctx: SessionContext) -> None:
    user = ctx.user_aggregator

    @user.event_handler("on_user_mute_started")
    async def on_user_mute_started(aggregator):
        logger.debug("User input muted")

    @user.event_handler("on_user_mute_stopped")
    async def on_user_mute_stopped(aggregator):
        logger.debug("User input unmuted")
