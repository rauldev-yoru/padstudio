"""Backend registry.

Adding a controller family means writing one module that implements
`base.Backend` and registering it here. Nothing else in the app changes.
"""

from __future__ import annotations

from .base import (
    Backend,
    Curve,
    Lighting,
    Macro,
    MacroStep,
    NotConnected,
    NotSupported,
    Status,
)
from .keylinker import KeyLinkerBackend

# Ordered by preference: the first backend that reports a device wins.
BACKENDS: list[type[Backend]] = [
    KeyLinkerBackend,
]


def create(family: str | None = None, address: str | None = None) -> Backend:
    """Build a backend by family name, or the only one there is."""
    if family is None:
        return BACKENDS[0](address=address)
    for cls in BACKENDS:
        if cls.family == family:
            return cls(address=address)
    raise ValueError(f"unknown backend family: {family}")


def families() -> list[str]:
    return [cls.family for cls in BACKENDS]


__all__ = [
    "Backend",
    "Curve",
    "Lighting",
    "Macro",
    "MacroStep",
    "NotConnected",
    "NotSupported",
    "Status",
    "BACKENDS",
    "create",
    "families",
]
