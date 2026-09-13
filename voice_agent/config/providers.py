"""Provider catalogues. Pure data; ``services/*/factory.py`` matches on these.

Adding a provider: add the enum member here, its API-key env var in
``LEGACY_KEY_ENV`` if it has a conventional one, then a ``case`` in the
matching factory — pyright flags the factory if the case is missing.
"""

from enum import StrEnum


class LLMProvider(StrEnum):
    BASETEN = "baseten"
    OPENAI = "openai"
    GEMINI = "gemini"
    GROQ = "groq"


class STTProvider(StrEnum):
    DEEPGRAM = "deepgram"
    GEMINI = "gemini"
    GROQ = "groq"
    CARTESIA = "cartesia"


class TTSProvider(StrEnum):
    CARTESIA = "cartesia"
    DEEPGRAM = "deepgram"
    GEMINI = "gemini"
    GROQ = "groq"


# provider value -> env var holding its API key when LLM__API_KEY etc. is not set.
# Keyed by the string value so one table serves all three enums.
LEGACY_KEY_ENV: dict[str, str] = {
    "baseten": "BASETEN_API_KEY",
    "openai": "OPENAI_API_KEY",
    "gemini": "GOOGLE_API_KEY",
    "groq": "GROQ_API_KEY",
    "deepgram": "DEEPGRAM_API_KEY",
    "cartesia": "CARTESIA_API_KEY",
}
