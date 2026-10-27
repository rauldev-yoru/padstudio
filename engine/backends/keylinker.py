"""KeyLinker family backend (Machenike, EasySMX, abxylute, KiiBoom, ...).

Thin adapter over the reverse-engineered `x20ctl` client, which is vendored
under `engine/vendor/x20ctl` (GPL-3.0-or-later, see CREDITS.md). Nothing about
the wire protocol lives here: this file only translates between that client and
the backend contract the UI speaks.

Two Windows-specific facts are encoded below on purpose:

* the BLE device must be resolved to a ``BLEDevice`` before connecting — passing
  the MAC as a string makes WinRT cancel the connection with
  ``WinError -2147023673``;
* an unvalidated model may read but not write, so the client's authorisation
  hook is replaced for a session. That hook exists to stop blind writes to an
  unknown pad; this backend only writes the features the UI exposes, each one
  read back afterwards.
"""

from __future__ import annotations

import asyncio
import dataclasses

from bleak import BleakScanner

from ..vendor.x20ctl.client import X20
from ..vendor.x20ctl import protocol as p

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

DEFAULT_ADDRESS = "98:B6:ED:4E:FF:E9"
SCAN_TIMEOUT = 8.0
CONNECT_ATTEMPTS = 6


async def _allow(packet):
    """Replacement for the client's validation gate (see module docstring)."""
    return None


class KeyLinkerBackend(Backend):
    family = "keylinker"

    def __init__(self, address: str | None = None):
        self.address = address or DEFAULT_ADDRESS
        self.pad: X20 | None = None

    # -- discovery / connection -------------------------------------------
    async def scan(self, timeout: float = SCAN_TIMEOUT) -> list[dict]:
        devices = await BleakScanner.discover(timeout=timeout, return_adv=True)
        out = []
        for dev, adv in devices.values():
            name = dev.name or ""
            if "G5" in name.upper() or (dev.address or "").upper().startswith("98:B6"):
                out.append({
                    "address": dev.address,
                    "name": name,
                    "rssi": adv.rssi,
                    "family": self.family,
                })
        return out

    async def _resolve(self, address: str, scan_timeout: float = SCAN_TIMEOUT,
                       attempts: int = CONNECT_ATTEMPTS):
        for attempt in range(max(1, attempts)):
            devices = await BleakScanner.discover(timeout=scan_timeout, return_adv=True)
            for dev, _adv in devices.values():
                if (dev.address or "").upper() == address.upper():
                    return dev
            if attempt + 1 < attempts:
                await asyncio.sleep(1.5)
        return None

    async def connect(self, address: str | None = None, *,
                      scan_timeout: float = SCAN_TIMEOUT,
                      attempts: int = CONNECT_ATTEMPTS) -> None:
        """Attach to the pad.

        The supervisor calls this with a short scan and one attempt, so a
        sleeping pad fails fast and gets retried instead of blocking the lock
        for a minute.
        """
        target = (address or self.address).upper()
        dev = await self._resolve(target, scan_timeout, attempts)
        pad = X20(dev if dev is not None else target, unvalidated_reads=True)
        await pad.connect()
        pad._authorize = _allow
        self.pad = pad
        self.address = target

    async def ping(self) -> bool:
        """One real query on the wire; raises if the pad stopped answering.

        `device_info()` caches, so a ping built on it would never touch the link
        and would happily report a dead pad as alive. READ_NAME is a genuine
        round trip and the cheapest one available.
        """
        pad = self._need()
        await pad.name()
        return True

    async def disconnect(self) -> None:
        if self.pad is not None:
            try:
                await self.pad.disconnect()
            finally:
                self.pad = None

    @property
    def connected(self) -> bool:
        return self.pad is not None

    def _need(self) -> X20:
        if self.pad is None:
            raise NotConnected("no controller connected")
        return self.pad

    # -- status ------------------------------------------------------------
    async def status(self) -> Status:
        if self.pad is None:
            return Status(connected=False, family=self.family)
        pad = self.pad
        info = await pad.device_info()
        caps = await pad.capabilities()
        battery = await pad.battery()
        try:
            name = await pad.name()
        except Exception:
            name = ""
        return Status(
            connected=True,
            family=self.family,
            name=name or "KeyLinker pad",
            model_id=f"{info.vid}:{info.pid}",
            firmware=str(info.version),
            battery=battery.level if battery else None,
            charging=battery.charging if battery else None,
            capabilities=dataclasses.asdict(caps) if dataclasses.is_dataclass(caps) else {},
            transport="BLE",
        )

    # -- lighting ----------------------------------------------------------
    async def lighting(self) -> Lighting:
        pad = self._need()
        body = await pad.read_body(p.Op.HOST_LIGHTING, bytes([0]))
        if body is None:
            raise NotSupported("lighting")
        entries = p.parse_lighting(body)
        if not entries:
            raise NotSupported("lighting")
        first = entries[0]
        return Lighting(
            r=first.r, g=first.g, b=first.b,
            brightness=first.light,
            zones=[{"rgb": list(e.rgb), "brightness": e.light} for e in entries],
        )

    async def set_lighting(self, r: int, g: int, b: int, brightness: int = 255) -> Lighting:
        pad = self._need()
        body = await pad.read_body(p.Op.HOST_LIGHTING, bytes([0]))
        if body is None:
            raise NotSupported("lighting")
        entries = p.parse_lighting(body)
        new = [p.LightingEntry(r, g, b, e.data4, e.data5, brightness) for e in entries]
        payload = bytes([body.declared]) + b"".join(e.to_bytes() for e in new)
        serial = p.save_button_serial(slot=0, counter=pad._next_save_counter())
        packet = p.build(
            p.Op.WRITE_LIGHTING,
            payload,
            serial=serial,
            length_field=p.host_length(len(payload), pad._next_host_counter()),
        )
        await pad._send(packet, serial)
        return await self.lighting()

    # -- curves ------------------------------------------------------------
    def _curve_out(self, c) -> Curve:
        return Curve(
            inner_deadzone=c.inner_deadzone,
            outer_deadzone=c.outer_deadzone,
            point1=tuple(c.point1),
            point2=tuple(c.point2),
            flags=c.flags,
            outer_raw=c.outer_raw,
            axis_max=p.CURVE_AXIS_MAX,
        )

    async def curves(self, kind: str) -> list[Curve]:
        pad = self._need()
        return [self._curve_out(c) for c in await pad.curves(kind)]

    async def set_curves(self, kind: str, channels: list[Curve]) -> list[Curve]:
        pad = self._need()
        current = await pad.curves(kind)
        if len(channels) != len(current):
            raise ValueError(f"this pad has {len(current)} {kind} channels")
        rebuilt = [
            p.Curve(
                inner_deadzone=ch.inner_deadzone,
                outer_raw=ch.outer_raw,
                point1=tuple(ch.point1),
                point2=tuple(ch.point2),
                flags=ch.flags,
                max_progress=current[i].max_progress,
            )
            for i, ch in enumerate(channels)
        ]
        return [self._curve_out(c) for c in await pad.set_curves(kind, rebuilt)]

    # -- names -------------------------------------------------------------
    async def key_map(self) -> dict[int, str]:
        """Button codes to names, as the pad itself reports its key list."""
        pad = self._need()
        layout = await pad.macro_layout()
        return {int(k): k.name for k in layout.digital}

    # -- remapping ---------------------------------------------------------
    async def remappings(self) -> dict[int, int]:
        pad = self._need()
        return await pad.remappings()

    async def set_remappings(self, changes: dict[int, int]) -> dict[int, int]:
        pad = self._need()
        return await pad.set_remapping(changes)

    async def remap_sources(self) -> list[int]:
        return await self._need().changekey_sources()

    # -- macros ------------------------------------------------------------
    @staticmethod
    def _decode_mask(mask: int, layout) -> list[str]:
        """Mask -> button names, using the layout the pad reported."""
        names = []
        for key, bit in layout.digital.items():
            if mask & (1 << bit):
                names.append(key.name)
        return names

    def _macro_out(self, slot: int, program, layout=None) -> Macro:
        if program is None:
            return Macro(slot=slot, steps=[], loop_ms=0)
        steps = [
            MacroStep(
                keys=self._decode_mask(s.mask, layout) if layout is not None else [],
                hold_ms=s.duration_ms,
            )
            for s in program.steps
        ]
        return Macro(
            slot=slot,
            steps=steps,
            loop_ms=program.loop_interval_ms,
            masks=[s.mask for s in program.steps],
        )

    async def macro(self, slot: int) -> Macro:
        pad = self._need()
        try:
            layout = await pad.macro_layout()
        except Exception:
            layout = None
        return self._macro_out(slot, await pad.read_macro(slot), layout)

    async def macros(self) -> dict[int, Macro]:
        pad = self._need()
        try:
            layout = await pad.macro_layout()
        except Exception:
            layout = None
        programs = await pad.macros()
        return {slot: self._macro_out(slot, prog, layout) for slot, prog in programs.items()}

    async def set_macro(self, slot: int, steps: list[MacroStep], loop_ms: int = 0) -> Macro:
        pad = self._need()
        text = ", ".join(
            (st.keys if isinstance(st.keys, str) else "+".join(st.keys)) + (f":{st.hold_ms}" if st.hold_ms else "")
            for st in steps
        )
        seq = p.parse_sequence(text, hold_ms=100, gap_ms=60)
        await pad.write_macro_steps(slot, seq, loop_ms=loop_ms)
        return await self.macro(slot)

    async def clear_macro(self, slot: int) -> None:
        await self._need().clear_macro(slot)

    # -- vibration ---------------------------------------------------------
    async def set_vibration(self, percent: int) -> tuple[int, int]:
        return await self._need().set_vibration(percent)

    # -- backup ------------------------------------------------------------
    async def backup(self) -> dict:
        pad = self._need()
        sticks = await self.curves("sticks")
        triggers = await self.curves("triggers")
        return {
            "family": self.family,
            "address": self.address,
            "lighting": dataclasses.asdict(await self.lighting()),
            "sticks": [dataclasses.asdict(c) for c in sticks],
            "triggers": [dataclasses.asdict(c) for c in triggers],
            "remaps": await self.remappings(),
            "macros": {str(k): dataclasses.asdict(v) for k, v in (await self.macros()).items()},
            "macros_raw": {
                str(slot): repr(await pad.read_macro(slot)) for slot in range(1, 5)
            },
        }

    async def restore(self, data: dict) -> None:
        pad = self._need()
        light = data.get("lighting") or {}
        if light:
            await self.set_lighting(light["r"], light["g"], light["b"], light.get("brightness", 255))
        for kind in ("sticks", "triggers"):
            channels = data.get(kind) or []
            if channels:
                await self.set_curves(
                    kind,
                    [
                        Curve(
                            inner_deadzone=c["inner_deadzone"],
                            outer_deadzone=c["outer_deadzone"],
                            point1=tuple(c["point1"]),
                            point2=tuple(c["point2"]),
                            flags=c.get("flags", 0),
                        )
                        for c in channels
                    ],
                )
        if data.get("remaps") is not None:
            await self.set_remappings({int(k): int(v) for k, v in (data.get("remaps") or {}).items()})
