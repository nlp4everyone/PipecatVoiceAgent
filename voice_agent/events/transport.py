"""Transport lifecycle: client connected / disconnected."""

from loguru import logger

from .context import SessionContext


def register(ctx: SessionContext) -> None:
    @ctx.transport.event_handler("on_client_connected")
    async def on_client_connected(transport, client):
        logger.info("Client connected")

    @ctx.transport.event_handler("on_client_disconnected")
    async def on_client_disconnected(transport, client):
        logger.info(f"Client disconnected. Stats: {ctx.stats}")
        await ctx.worker.cancel()
