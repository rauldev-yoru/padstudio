"""XInput bindings: live input and real haptics.

Two different channels live on this pad and they are easy to confuse:

* the **BLE configuration link** stores settings (lighting, curves, macros) and
  also exposes a "motor strength" register — that register is a *level*, not a
  command, so writing it never makes the pad buzz;
* **XInput** is the gameplay channel Windows drives. `XInputGetState` gives live
  sticks/triggers/buttons and `XInputSetState` fires the motors for real.

This module is the second one, through ctypes, with no third-party dependency.
It is a no-op off Windows so the package still imports on other machines.
"""

from __future__ import annotations

import ctypes
import sys
import time
from ctypes import wintypes

MAX_SLOTS = 4
ERROR_SUCCESS = 0
ERROR_DEVICE_NOT_CONNECTED = 1167


class _Gamepad(ctypes.Structure):
    _fields_ = [
        ("wButtons", wintypes.WORD),
        ("bLeftTrigger", ctypes.c_ubyte),
        ("bRightTrigger", ctypes.c_ubyte),
        ("sThumbLX", ctypes.c_short),
        ("sThumbLY", ctypes.c_short),
        ("sThumbRX", ctypes.c_short),
        ("sThumbRY", ctypes.c_short),
    ]


class _State(ctypes.Structure):
    _fields_ = [("dwPacketNumber", wintypes.DWORD), ("Gamepad", _Gamepad)]


class _Vibration(ctypes.Structure):
    _fields_ = [("wLeftMotorSpeed", wintypes.WORD), ("wRightMotorSpeed", wintypes.WORD)]


BUTTON_NAMES = {
    0x0001: "DPAD_UP",
    0x0002: "DPAD_DOWN",
    0x0004: "DPAD_LEFT",
    0x0008: "DPAD_RIGHT",
    0x0010: "START",
    0x0020: "BACK",
    0x0040: "L3",
    0x0080: "R3",
    0x0100: "LB",
    0x0200: "RB",
    0x1000: "A",
    0x2000: "B",
    0x4000: "X",
    0x8000: "Y",
}

_lib = None
_ready = False


def _load():
    """Load xinput1_4, falling back to 1_3 and 9_1_0 (the pre-Win8 name)."""
    global _lib, _ready
    if _ready:
        return _lib
    _ready = True
    if sys.platform != "win32":
        _lib = None
        return None
    for name in ("xinput1_4", "xinput1_3", "xinput9_1_0"):
        try:
            _lib = ctypes.windll.LoadLibrary(name)
            return _lib
        except OSError:
            continue
    _lib = None
    return None


def available() -> bool:
    return _load() is not None


def _state(slot: int):
    lib = _load()
    if lib is None:
        return None
    st = _State()
    if lib.XInputGetState(slot, ctypes.byref(st)) != ERROR_SUCCESS:
        return None
    return st


def slots() -> list[int]:
    """Slots currently reporting a state (0-3)."""
    return [s for s in range(MAX_SLOTS) if _state(s) is not None]


def read(slot: int = 0) -> dict:
    """One snapshot, normalised to -1..1 for sticks and 0..1 for triggers."""
    st = _state(slot)
    if st is None:
        return {"connected": False, "slot": slot}
    g = st.Gamepad
    return {
        "connected": True,
        "slot": slot,
        "packet": st.dwPacketNumber,
        "left": {"x": g.sThumbLX / 32767.0, "y": g.sThumbLY / 32767.0},
        "right": {"x": g.sThumbRX / 32767.0, "y": g.sThumbRY / 32767.0},
        "triggers": {"left": g.bLeftTrigger / 255.0, "right": g.bRightTrigger / 255.0},
        "buttons": [name for bit, name in BUTTON_NAMES.items() if g.wButtons & bit],
        "raw_buttons": g.wButtons,
    }


def pulse(left: float = 1.0, right: float = 1.0, ms: int = 400, slot: int = 0) -> bool:
    """Fire both motors for `ms` milliseconds, then stop them.

    `left`/`right` are 0..1. A pulse is used instead of leaving the motors on so
    a crash or a lost caller cannot leave the pad buzzing forever.
    """
    lib = _load()
    if lib is None:
        return False
    vib = _Vibration(
        int(max(0.0, min(1.0, left)) * 65535),
        int(max(0.0, min(1.0, right)) * 65535),
    )
    if lib.XInputSetState(slot, ctypes.byref(vib)) != ERROR_SUCCESS:
        return False
    try:
        time.sleep(max(0, ms) / 1000.0)
    finally:
        stop = _Vibration(0, 0)
        lib.XInputSetState(slot, ctypes.byref(stop))
    return True
