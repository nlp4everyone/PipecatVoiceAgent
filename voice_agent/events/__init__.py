"""Event handlers, grouped by the object that emits them.

Each module exposes `register(ctx)`; `register_all` wires them in one call.
"""

from . import interruptions, mute, rtvi, transport, turns
from .context import SessionContext

__all__ = ["SessionContext", "register_all"]

_REGISTRARS = (
    transport.register,
    rtvi.register,
    turns.register,
    mute.register,
    interruptions.register,
)


def register_all(ctx: SessionContext) -> None:
    for register in _REGISTRARS:
        register(ctx)
