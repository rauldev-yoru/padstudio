"""PadStudio engine — local HTTP API over a controller backend.

Runs on 127.0.0.1 only: this process owns the single BLE link to the pad, and
the desktop UI talks to it over HTTP. One connection at a time is a hardware
fact (the pad accepts exactly one), so every mutating call takes a lock and the
UI never has to think about it.

    python -m engine.app --port 8477
"""

from __future__ import annotations

import argparse
import asyncio
import contextlib
import dataclasses
import logging
import time
from typing import Any

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from . import backends
from . import xinput
from .backends import Curve, MacroStep, NotConnected, NotSupported

log = logging.getLogger("padstudio")

app = FastAPI(title="PadStudio engine", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "file://", "null"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_lock = asyncio.Lock()
_state: dict[str, Any] = {"backend": None, "family": None}

# Connection supervisor state. The pad sleeps, and when it does the BLE link
# dies with no notification: without this, the engine sits on a dead handle
# until a human presses Connect.
_supervisor: asyncio.Task | None = None
_auto: dict[str, Any] = {
    "enabled": True,
    "failures": 0,
    "last_attempt": 0.0,
    "last_error": "",
    "last_connected": None,
}


async def _supervise() -> None:
    """Keep the link alive: retry a sleeping pad, and notice a dead handle."""
    while True:
        await asyncio.sleep(3.0)
        if not _auto["enabled"]:
            continue
        try:
            backend = _backend()
        except Exception as exc:  # backend construction failed, keep trying
            _auto["last_error"] = f"{type(exc).__name__}: {exc}"
            continue

        if not backend.connected:
            backoff = min(20.0, 2.0 + 2.0 * _auto["failures"])
            if time.monotonic() - _auto["last_attempt"] < backoff:
                continue
            _auto["last_attempt"] = time.monotonic()
            async with _lock:
                if backend.connected:
                    continue
                try:
                    await backend.connect(scan_timeout=6.0, attempts=1)
                    _auto["failures"] = 0
                    _auto["last_error"] = ""
                    _auto["last_connected"] = time.time()
                    log.info("auto-reconnect: attached to %s", getattr(backend, "address", "?"))
                except Exception as exc:
                    _auto["failures"] += 1
                    _auto["last_error"] = f"{type(exc).__name__}: {exc}"
                    log.info("auto-reconnect attempt %d failed: %s", _auto["failures"], exc)
            continue

        # Connected: prove the handle is still real.
        try:
            async with _lock:
                await asyncio.wait_for(backend.ping(), timeout=10.0)
        except Exception as exc:
            _auto["last_error"] = f"link lost: {type(exc).__name__}: {exc}"
            log.info("link lost, dropping the handle: %s", exc)
            with contextlib.suppress(Exception):
                await backend.disconnect()


@app.on_event("startup")
async def _start_supervisor() -> None:
    global _supervisor
    if _supervisor is None:
        _supervisor = asyncio.create_task(_supervise())


@app.on_event("shutdown")
async def _stop_supervisor() -> None:
    if _supervisor is not None:
        _supervisor.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await _supervisor


def _backend():
    if _state["backend"] is None:
        _state["backend"] = backends.create()
        _state["family"] = _state["backend"].family
    return _state["backend"]


def _dump(obj: Any) -> Any:
    if dataclasses.is_dataclass(obj):
        return dataclasses.asdict(obj)
    return obj


def _guard(fn):
    """Turn backend exceptions into HTTP errors with a stable shape."""

    async def wrapper(*args, **kwargs):
        try:
            return fn(*args, **kwargs)
        except NotConnected as exc:
            raise HTTPException(409, str(exc)) from exc
        except NotSupported as exc:
            raise HTTPException(501, f"not supported: {exc}") from exc
        except ValueError as exc:
            raise HTTPException(400, str(exc)) from exc

    return wrapper


# -- models ---------------------------------------------------------------
class ConnectBody(BaseModel):
    address: str | None = None


class LightingBody(BaseModel):
    r: int
    g: int
    b: int
    brightness: int = 255


class CurveBody(BaseModel):
    inner_deadzone: int
    outer_deadzone: int
    point1: tuple[int, int]
    point2: tuple[int, int]
    flags: int = 0
    outer_raw: int = 0
    axis_max: int = 255


class CurvesBody(BaseModel):
    channels: list[CurveBody]


class RemapBody(BaseModel):
    changes: dict[int, int]


class MacroStepBody(BaseModel):
    keys: list[str] | str = []
    hold_ms: int = 100


class MacroBody(BaseModel):
    steps: list[MacroStepBody]
    loop_ms: int = 0


class VibrationBody(BaseModel):
    percent: int


class RumbleBody(BaseModel):
    left: float = 1.0
    right: float = 1.0
    ms: int = 400
    slot: int = 0


# -- discovery / lifecycle ------------------------------------------------
@app.get("/health")
async def health() -> dict:
    return {
        "ok": True,
        "families": backends.families(),
        "connected": bool(_state["backend"] and _state["backend"].connected),
    }


@app.get("/scan")
async def scan(timeout: float = 8.0) -> dict:
    return {"devices": await _backend().scan(timeout=timeout)}


@app.post("/connect")
async def connect(body: ConnectBody) -> dict:
    async with _lock:
        backend = _backend()
        if backend.connected:
            await backend.disconnect()
        await backend.connect(body.address)
        return _dump(await backend.status())


@app.post("/disconnect")
async def disconnect() -> dict:
    async with _lock:
        await _backend().disconnect()
        return {"connected": False}


@app.get("/auto")
async def get_auto() -> dict:
    return dict(_auto)


@app.put("/auto")
async def put_auto(body: dict) -> dict:
    if "enabled" in body:
        _auto["enabled"] = bool(body["enabled"])
        _auto["failures"] = 0
        _auto["last_attempt"] = 0.0
    return dict(_auto)


@app.get("/status")
async def status() -> dict:
    return _dump(await _backend().status())


# -- lighting -------------------------------------------------------------
@app.get("/lighting")
async def get_lighting() -> dict:
    return _dump(await _backend().lighting())


@app.put("/lighting")
async def put_lighting(body: LightingBody) -> dict:
    async with _lock:
        return _dump(await _backend().set_lighting(body.r, body.g, body.b, body.brightness))


# -- curves ---------------------------------------------------------------
@app.get("/curves/{kind}")
async def get_curves(kind: str) -> dict:
    if kind not in ("sticks", "triggers"):
        raise HTTPException(400, "kind must be sticks or triggers")
    return {"channels": [_dump(c) for c in await _backend().curves(kind)]}


@app.put("/curves/{kind}")
async def put_curves(kind: str, body: CurvesBody) -> dict:
    if kind not in ("sticks", "triggers"):
        raise HTTPException(400, "kind must be sticks or triggers")
    channels = [Curve(**c.model_dump()) for c in body.channels]
    async with _lock:
        return {"channels": [_dump(c) for c in await _backend().set_curves(kind, channels)]}


# -- remapping ------------------------------------------------------------
@app.get("/keys")
async def get_keys() -> dict:
    """Button codes to human names, as reported by the pad itself."""
    backend = _backend()
    try:
        names = await backend.key_map()
    except Exception as exc:
        raise HTTPException(501, f"key names unavailable: {exc}") from exc
    return {"names": {str(k): v for k, v in names.items()}}


@app.get("/remap")
async def get_remap() -> dict:
    backend = _backend()
    out = {"remaps": await backend.remappings()}
    with contextlib.suppress(NotSupported, AttributeError):
        out["sources"] = await backend.remap_sources()
    with contextlib.suppress(NotSupported, AttributeError):
        out["names"] = {str(k): v for k, v in (await backend.key_map()).items()}
    return out


@app.put("/remap")
async def put_remap(body: RemapBody) -> dict:
    async with _lock:
        return {"remaps": await _backend().set_remappings(body.changes)}


# -- macros ---------------------------------------------------------------
@app.get("/macros")
async def get_macros() -> dict:
    return {"macros": {str(k): _dump(v) for k, v in (await _backend().macros()).items()}}


@app.get("/macros/{slot}")
async def get_macro(slot: int) -> dict:
    return _dump(await _backend().macro(slot))


@app.put("/macros/{slot}")
async def put_macro(slot: int, body: MacroBody) -> dict:
    steps = [MacroStep(keys=s.keys, hold_ms=s.hold_ms) for s in body.steps]
    async with _lock:
        return _dump(await _backend().set_macro(slot, steps, body.loop_ms))


@app.delete("/macros/{slot}")
async def delete_macro(slot: int) -> dict:
    async with _lock:
        await _backend().clear_macro(slot)
        return {"slot": slot, "cleared": True}


# -- extras ---------------------------------------------------------------
@app.post("/vibration")
async def post_vibration(body: VibrationBody) -> dict:
    """The stored motor *strength* (a setting, not a rumble)."""
    async with _lock:
        left, right = await _backend().set_vibration(body.percent)
        return {"left": left, "right": right}


# -- live input and haptics (XInput, not the BLE config link) -------------
@app.get("/input")
async def get_input(slot: int = 0) -> dict:
    if not xinput.available():
        raise HTTPException(501, "XInput is only available on Windows")
    return xinput.read(slot)


@app.get("/input/slots")
async def get_input_slots() -> dict:
    if not xinput.available():
        raise HTTPException(501, "XInput is only available on Windows")
    return {"slots": xinput.slots()}


@app.post("/rumble")
async def post_rumble(body: RumbleBody) -> dict:
    """Real haptics: pulses both motors through XInput, then stops them."""
    if not xinput.available():
        raise HTTPException(501, "XInput is only available on Windows")
    fired = await asyncio.to_thread(xinput.pulse, body.left, body.right, body.ms, body.slot)
    if not fired:
        raise HTTPException(409, f"no XInput controller in slot {body.slot}")
    return {"fired": True, "ms": body.ms, "slot": body.slot}


@app.websocket("/input/ws")
async def input_stream(ws: WebSocket) -> None:
    """Live sticks/triggers at ~30 Hz. Read-only, never touches the BLE link."""
    await ws.accept()
    slot = 0
    try:
        while True:
            payload = xinput.read(slot) if xinput.available() else {"connected": False}
            await ws.send_json(payload)
            await asyncio.sleep(1 / 30)
    except WebSocketDisconnect:
        return


@app.get("/backup")
async def get_backup() -> dict:
    return await _backend().backup()


@app.post("/restore")
async def post_restore(body: dict) -> dict:
    async with _lock:
        await _backend().restore(body)
        return {"restored": True}


# -- live events ----------------------------------------------------------
@app.websocket("/events")
async def events(ws: WebSocket) -> None:
    """Push status every two seconds so the UI never polls the BLE link."""
    await ws.accept()
    try:
        while True:
            try:
                payload = _dump(await _backend().status())
            except Exception as exc:  # keep the socket alive through BLE hiccups
                payload = {"connected": False, "error": str(exc)}
            payload["auto"] = {
                "enabled": _auto["enabled"],
                "failures": _auto["failures"],
                "last_error": _auto["last_error"],
                "retrying": bool(_auto["enabled"]) and not payload.get("connected"),
            }
            await ws.send_json(payload)
            await asyncio.sleep(2.0)
    except WebSocketDisconnect:
        return


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8477)
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO)
    import uvicorn

    uvicorn.run(app, host=args.host, port=args.port, log_level="info")


if __name__ == "__main__":
    main()
