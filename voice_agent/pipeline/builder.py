"""Assemble aggregators, Pipeline and PipelineWorker.

This is the only module that knows the *order* of processors.
"""

from pipecat.observers.base_observer import BaseObserver
from pipecat.pipeline.llm_switcher import LLMSwitcher
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.worker import PipelineParams, PipelineWorker, ProcessorUnusablePolicy
from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.processors.aggregators.llm_response_universal import (
    LLMContextAggregatorPair,
    LLMUserAggregatorParams,
)
from pipecat.services.llm_service import LLMService
from pipecat.transports.base_transport import BaseTransport

from voice_agent.services import Services


def build_aggregators(user_params: LLMUserAggregatorParams) -> tuple[LLMContext, LLMContextAggregatorPair]:
    """Create the conversation context and the pair of processors that fill it.

    ``LLMContext`` is the message list sent to the LLM. The pair wraps it in
    two processors: ``user()`` turns transcripts into user messages (driven by
    the turn policy in ``user_params``) and triggers the LLM; ``assistant()``
    records what the bot actually said. The context is returned separately
    because event handlers read / reset it directly.
    """
    context = LLMContext()
    return context, LLMContextAggregatorPair(context, user_params=user_params)


def build_llm(svc: Services) -> LLMService | LLMSwitcher:
    """Primary LLM, wrapped in an ``LLMSwitcher`` when a fallback is configured.

    The switcher is itself a pipeline stage; ``events/`` can flip it to the
    fallback at runtime (e.g. on provider errors) without rebuilding anything.
    """
    if svc.llm_fallback is None:
        return svc.llm
    return LLMSwitcher([svc.llm, svc.llm_fallback])


def build_pipeline(transport: BaseTransport,
                   svc: Services,
                   llm: LLMService | LLMSwitcher,
                   aggregators: LLMContextAggregatorPair) -> Pipeline:
    """Wire the processors in frame-flow order.

    audio in -> STT -> user aggregator -> LLM -> TTS -> audio out -> assistant
    aggregator. The assistant aggregator sits *after* transport output so it
    records only text that was actually spoken (interruptions truncate it).
    """
    return Pipeline(
        [
            transport.input(),
            svc.stt,
            aggregators.user(),
            llm,
            svc.tts,
            transport.output(),
            aggregators.assistant(),
        ]
    )


def build_worker(pipeline: Pipeline,
                 *,
                 idle_timeout_secs: float | None,
                 observers: list[BaseObserver] | None = None) -> PipelineWorker:
    """Run the pipeline under a ``PipelineWorker``.

    Args:
        pipeline: From ``build_pipeline``.
        idle_timeout_secs: End the session after this long without user or bot
            activity; ``None`` disables. Comes from the runner args.
        observers: Passive taps on the frame stream (metrics, transcript
            logging ...); see ``pipeline/observers``.
    """
    return PipelineWorker(
        pipeline,
        params=PipelineParams(enable_metrics=True, enable_usage_metrics=True),  # TTFB + token usage
        idle_timeout_secs=idle_timeout_secs,
        # a service that becomes unusable (e.g. lost websocket) ends the session
        # gracefully instead of leaving the user talking to nothing
        processor_unusable_policy=ProcessorUnusablePolicy.END,
        observers=observers or [],
    )
