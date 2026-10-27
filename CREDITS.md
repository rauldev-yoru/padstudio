# Credits and licensing

PadStudio is licensed **GPL-3.0-or-later**, because it vendors and links
against work that is already GPL-3.0.

## Vendored

- `engine/vendor/x20ctl` — **X20CTL** by Amjad AAYD
  (<https://github.com/AmjadAAYD/x20ctl>), GPL-3.0-or-later.
  It carries the reverse-engineered KeyLinker/Keylinker protocol: packet layout,
  opcodes, record structures and the BLE client. Without that work this project
  would not exist. The vendored copy is unmodified except for being pinned to
  the release we validated against.

## Protocol research

KeyLinker is a protocol by ShenZhen ZhiXu Technology (深圳市智旭科技). The
configuration service lives on the pad's Bluetooth LE GATT interface; the phone
app vendors ship is the only official client and there is no documented
specification. All protocol knowledge here comes from X20CTL's published
research.

## Trademarks

Machenike, EasySMX, abxylute, KiiBoom and KeyLinker are trademarks of their
owners. This project is independent and not endorsed by any of them.
