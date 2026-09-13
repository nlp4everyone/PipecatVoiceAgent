"""Per-session bag of references that event handlers need.

Pipecat event handlers are registered on *instances* (transport, aggregators,
strategies, worker.rtvi), so registration must happen after construction and
every handler needs several of those objects. Passing one `SessionContext`
around replaces a pile of closures inside `run_bot`.
"""

from dataclasses import dataclass, field
from typing import Any

from pipecat.pipeline.worker import PipelineWorker
from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.processors.aggregators.llm_response_universal import LLMContextAggregatorPair
from pipecat.transports.base_transport import BaseTransport
from pipecat.turns.user_start import BaseUserTurnStartStrategy

from voice_agent.config.settings import Settings


@dataclass
class SessionContext:
    transport: BaseTransport
    worker: PipelineWorker
    llm_context: LLMContext
    aggregators: LLMContextAggregatorPair
    settings: Settings
    start_strategies: list[BaseUserTurnStartStrategy] = field(default_factory=list)

    # mutable per-session state shared between handlers
    stats: dict[str, Any] = field(default_factory=dict)

    @property
    def user_aggregator(self):
        return self.aggregators.user()

    @property
    def assistant_aggregator(self):
        return self.aggregators.assistant()

    def bump(self, key: str) -> int:
        self.stats[key] = self.stats.get(key, 0) + 1
        return self.stats[key]
