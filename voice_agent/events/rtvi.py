"""RTVI client events (browser / Pipecat client SDKs)."""

from pipecat.frames.frames import LLMRunFrame

from .context import SessionContext


def register(ctx: SessionContext) -> None:
    @ctx.worker.rtvi.event_handler("on_client_ready")
    async def on_client_ready(rtvi):
        ctx.llm_context.add_message(
            {"role": "developer", "content": "Start by concisely introducing yourself."}
        )
        await ctx.worker.queue_frames([LLMRunFrame()])
