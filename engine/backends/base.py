"""Backend contract: everything a controller family must be able to answer.

The UI never talks to a protocol directly. Each backend implements this
interface for one family of controllers, and `backends.registry` picks the
right one for whatever was discovered.

A backend is allowed to say "this pad cannot do that" (raise NotSupported);
what it must never do is fake a capability the hardware does not report.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


class NotSupported(RuntimeError):
    """The connected controller does not expose this feature."""


class NotConnected(RuntimeError):
    """No controller is currently attached."""


@dataclass
class Lighting:
    r: int
    g: int
    b: int
    brightness: int = 255
    effect: int = 0
    zones: list[dict[str, Any]] = field(default_factory=list)


@dataclass
class Curve:
    inner_deadzone: int
    outer_deadzone: int
    point1: tuple[int, int]
    point2: tuple[int, int]
    flags: int = 0
    # Raw bytes exactly as the controller stores them. `outer_raw` is the one on
    # the same 0-255 axis as the curve points; `outer_deadzone` is the derived
    # value the vendor app displays. Both travel to the UI so nothing has to be
    # guessed from one number alone.
    outer_raw: int = 0
    axis_max: int = 255


@dataclass
class MacroStep:
    keys: list[str]
    hold_ms: int


@dataclass
class Macro:
    slot: int
    steps: list[MacroStep]
    loop_ms: int = 0
    # Raw per-step button masks, when the backend can only report them that way
    # (KeyLinker stores a bitmask, not names).
    masks: list[int] = field(default_factory=list)


@dataclass
class Status:
    connected: bool
    family: str = ""
    name: str = ""
    model_id: str = ""
    firmware: str = ""
    battery: int | None = None
    charging: bool | None = None
    capabilities: dict[str, Any] = field(default_factory=dict)
    transport: str = ""


class Backend:
    """One controller family. Methods raise NotSupported when unsupported."""

    family = "unknown"

    async def scan(self, timeout: float = 8.0) -> list[dict[str, Any]]:
        raise NotImplementedError

    async def connect(self, address: str | None = None) -> None:
        raise NotImplementedError

    async def disconnect(self) -> None:
        raise NotImplementedError

    @property
    def connected(self) -> bool:
        raise NotImplementedError

    async def status(self) -> Status:
        raise NotImplementedError

    async def ping(self) -> bool:
        """Cheap liveness check. Raises when the link is gone."""
        await self.status()
        return True

    async def set_lighting(self, r: int, g: int, b: int, brightness: int = 255) -> Lighting:
        raise NotSupported("lighting")

    async def lighting(self) -> Lighting:
        raise NotSupported("lighting")

    async def curves(self, kind: str) -> list[Curve]:
        raise NotSupported("curves")

    async def set_curves(self, kind: str, channels: list[Curve]) -> list[Curve]:
        raise NotSupported("curves")

    async def remappings(self) -> dict[int, int]:
        raise NotSupported("remapping")

    async def set_remappings(self, changes: dict[int, int]) -> dict[int, int]:
        raise NotSupported("remapping")

    async def macros(self) -> dict[int, Macro]:
        raise NotSupported("macros")

    async def macro(self, slot: int) -> Macro | None:
        raise NotSupported("macros")

    async def set_macro(self, slot: int, steps: list[MacroStep], loop_ms: int = 0) -> Macro | None:
        raise NotSupported("macros")

    async def clear_macro(self, slot: int) -> None:
        raise NotSupported("macros")

    async def set_vibration(self, percent: int) -> tuple[int, int]:
        raise NotSupported("vibration")

    async def backup(self) -> dict[str, Any]:
        raise NotImplementedError

    async def restore(self, data: dict[str, Any]) -> None:
        raise NotImplementedError
