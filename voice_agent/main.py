"""Session entry point. Wiring only — no business logic lives here.

``bot()`` is what the Pipecat runner (local ``uv run bot.py``, the
``pipecat-base`` Docker image, Pipecat Cloud) calls once per session with a
``RunnerArguments``. It creates the transport, then ``run_bot`` reads
``Settings`` and assembles the session in five steps that each map to a
package: services → turns → pipeline → events → run.
"""

import sys

from dotenv import load_dotenv
from loguru import logger
from pipecat.runner.types import RunnerArguments
from pipecat.runner.utils import create_transport
from pipecat.transports.base_transport import BaseTransport, TransportParams
from pipecat.transports.daily.transport import DailyParams
from pipecat.workers.runner import WorkerRunner

from voice_agent import events, turns
from voice_agent.config import PROFILES, Settings
from voice_agent.events import SessionContext
from voice_agent.pipeline import builder
from voice_agent.services import build_services

# .env wins over the process environment so a local run is reproducible
load_dotenv(override=True)

# Transport factories keyed by the runner's ``-t`` flag / deployment type.
# The runner picks one and passes its params to the matching transport class.
TRANSPORT_PARAMS = {
    "daily": lambda: DailyParams(audio_in_enabled=True, audio_out_enabled=True),
    "webrtc": lambda: TransportParams(audio_in_enabled=True, audio_out_enabled=True),
}


def _setup_logging(level: str) -> None:
    """Route loguru to stderr at ``level``.

    Pipecat's default sink is removed so the app controls the level, and the
    "No audio frame received" line is dropped: it fires every second while
    the client is silent and drowns everything else.
    """
    logger.remove()
    logger.add(
        sys.stderr,
        level=level,
        filter=lambda r: "No audio frame received" not in r["message"],
    )


async def run_bot(transport: BaseTransport,
                  runner_args: RunnerArguments) -> None:
    """Build and run one session on an already-created transport.

    Split from ``bot()`` so tests can inject a transport. Construction order
    matters: strategies are built before the pipeline (the aggregator needs
    them), and event handlers are registered last because Pipecat handlers
    bind to instances that must already exist.

    Args:
        transport: Audio in/out for this session (Daily room, WebRTC peer ...).
        runner_args: Runner-provided knobs: idle timeout, signal handling,
            optional request body / telephony call data.
    """
    settings = Settings()  # env / .env -> validated config; fails fast on a bad provider
    _setup_logging(settings.log_level)
    profile = PROFILES[settings.turn_profile]
    logger.info(
        f"Starting bot — llm={settings.llm.provider}/{settings.llm.model} "
        f"stt={settings.stt.provider} tts={settings.tts.provider} "
        f"profile={settings.turn_profile}"
    )

    # 1. services — STT / LLM / TTS / VAD instances for the chosen providers.
    #    Created here, connected by Pipecat when the pipeline starts.
    svc = build_services(settings)

    # 2. turn-taking policy — when the user starts / stops / is muted,
    #    derived from the profile. Also yields the start strategies for step 4.
    user_turn = turns.build_user_turn(profile, svc.vad)

    # 3. pipeline — context + aggregators, LLM (with optional fallback switcher),
    #    the ordered processor chain, and the worker that runs it.
    llm_context, aggregators = builder.build_aggregators(user_turn.params)
    llm = builder.build_llm(svc)
    pipeline = builder.build_pipeline(transport, svc, llm, aggregators)
    worker = builder.build_worker(
        pipeline, idle_timeout_secs=runner_args.pipeline_idle_timeout_secs
    )

    # Everything the event handlers need, in one object (see events/context.py).
    ctx = SessionContext(
        transport=transport,
        worker=worker,
        llm_context=llm_context,
        aggregators=aggregators,
        settings=settings,
        start_strategies=user_turn.start_strategies,
    )

    # 4. event handlers — transport lifecycle, RTVI client-ready, turn events,
    #    mute/interruption bookkeeping. Must come after every instance exists.
    events.register_all(ctx)

    # 5. run — blocks until the worker ends (client left, idle timeout, error).
    #    The runner decides who owns SIGINT: locally the bot, on Cloud the host.
    runner = WorkerRunner(handle_sigint=runner_args.handle_sigint)
    await runner.add_workers(worker)
    await runner.run()


async def bot(runner_args: RunnerArguments) -> None:
    """Session entry point re-exported by ``bot.py`` (root).

    The runner calls this once per session. ``create_transport`` inspects
    ``runner_args`` (its concrete subclass says Daily vs WebRTC vs telephony)
    and builds the transport with the matching ``TRANSPORT_PARAMS`` factory.
    """
    transport = await create_transport(runner_args, TRANSPORT_PARAMS)
    await run_bot(transport, runner_args)
