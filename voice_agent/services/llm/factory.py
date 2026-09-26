"""LLM factory: LLMConfig -> Pipecat LLMService.

Providers: baseten | openai | gemini | groq. Settings field names differ
slightly per provider (e.g. the max-tokens parameter). The system prompt is
passed as ``system_instruction`` so it is not part of the context messages
and survives context resets.
"""

from typing import assert_never

# Service
from pipecat.services.baseten.llm import BasetenLLMService
from pipecat.services.llm_service import LLMService
from pipecat.services.openai.llm import OpenAILLMService
from pipecat.services.google.llm import GoogleLLMService
from pipecat.services.groq.llm import GroqLLMService

from voice_agent.config.defaults import LLM_DEFAULT_MODEL
from voice_agent.config.providers import LLMProvider
from voice_agent.config.settings import LLMConfig


def create_llm(cfg: LLMConfig) -> LLMService:
    """Build the LLM service for ``cfg.provider``.

    ``match`` is exhaustive over ``LLMProvider``; pyright flags a missing case.
    """
    key = cfg.api_key.get_secret_value() if cfg.api_key else "none"

    match cfg.provider:
        case LLMProvider.BASETEN:
            # Baseten: OpenAI-compatible
            return BasetenLLMService(
                api_key=key,
                settings=BasetenLLMService.Settings(
                    model=cfg.model or LLM_DEFAULT_MODEL[cfg.provider],
                    temperature=cfg.temperature,
                    max_completion_tokens=cfg.max_tokens,
                    system_instruction=cfg.system_instruction,
                ),
            )
        case LLMProvider.OPENAI:
            # OpenAI
            return OpenAILLMService(
                api_key=key,
                settings=OpenAILLMService.Settings(
                    model=cfg.model or LLM_DEFAULT_MODEL[cfg.provider],
                    temperature=cfg.temperature,
                    max_completion_tokens=cfg.max_tokens,
                    system_instruction=cfg.system_instruction,
                ),
            )
        case LLMProvider.GEMINI:
            # Gemini: native Google client, uses max_tokens
            return GoogleLLMService(
                api_key=key,
                settings=GoogleLLMService.Settings(
                    model=cfg.model or LLM_DEFAULT_MODEL[cfg.provider],
                    temperature=cfg.temperature,
                    max_tokens=cfg.max_tokens,
                    system_instruction=cfg.system_instruction,
                ),
            )
        case LLMProvider.GROQ:
            # Groq: OpenAI-compatible
            return GroqLLMService(
                api_key=key,
                settings=GroqLLMService.Settings(
                    model=cfg.model or LLM_DEFAULT_MODEL[cfg.provider],
                    temperature=cfg.temperature,
                    max_completion_tokens=cfg.max_tokens,
                    system_instruction=cfg.system_instruction,
                ),
            )
        case _ as unreachable:
            assert_never(unreachable)