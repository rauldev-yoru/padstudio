# PadStudio

Desktop controller studio for gamepads that expose a configuration channel.
Today it speaks **KeyLinker** (Machenike, EasySMX, abxylute, KiiBoom and other
pads built on ShenZhen ZhiXu's stack): lighting, stick/trigger curves, button
remapping, macros, battery and firmware — from the PC, over Bluetooth LE.

```
engine/   Python FastAPI sidecar (bleak + KeyLinker protocol) on 127.0.0.1:8477
app/      Electron + React + Vite + Tailwind + shadcn/ui  (UI)
```

The UI never touches Bluetooth: it talks HTTP to the engine, which owns the
single BLE link. Backends are pluggable — `keylinker` today, an XInput backend
for closed controllers (status + input testing) is the next family.

## Run (dev)

```bash
# engine (Windows, needs the pad awake and paired)
python -m engine.app --port 8477

# UI
cd app && npm install && npm run dev      # http://localhost:5173
```

See `CREDITS.md` for licensing: this project is GPL-3.0-or-later because it
vendors the reverse-engineered KeyLinker client from X20CTL.
