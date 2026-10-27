/** Minimal typed client for the PadStudio engine (127.0.0.1:8477). */

export const ENGINE = "http://127.0.0.1:8477";

export type Capabilities = {
  sticks?: number;
  triggers?: number;
  motors?: number;
  turbo?: number;
  macros?: number;
  changekey?: number;
  lighting?: number;
  [k: string]: unknown;
};

export type Status = {
  connected: boolean;
  family?: string;
  name?: string;
  model_id?: string;
  firmware?: string;
  /** Four-step gauge, 1..4. The pad does not report a percentage. */
  battery?: number | null;
  charging?: boolean | null;
  capabilities?: Capabilities;
  transport?: string;
  error?: string;
  /** Present on live websocket events: supervisor state. */
  auto?: { enabled: boolean; failures: number; last_error: string; retrying: boolean };
};

export type Lighting = {
  r: number;
  g: number;
  b: number;
  brightness: number;
  zones?: { rgb: number[]; brightness: number }[];
};

export type Curve = {
  inner_deadzone: number;
  outer_deadzone: number;
  point1: [number, number];
  point2: [number, number];
  flags?: number;
  /** Outer limit on the same 0-255 axis as the curve points. */
  outer_raw?: number;
  axis_max?: number;
};

export type InputState = {
  connected: boolean;
  slot?: number;
  packet?: number;
  /** Sticks normalised to -1..1, triggers to 0..1. */
  left?: { x: number; y: number };
  right?: { x: number; y: number };
  triggers?: { left: number; right: number };
  buttons?: string[];
};

export type Macro = {
  slot: number;
  steps: { keys: string[] | string; hold_ms: number }[];
  loop_ms: number;
  masks?: number[];
};

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${ENGINE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status} ${detail}`);
  }
  return (await res.json()) as T;
}

export const api = {
  health: () => call<{ ok: boolean; families: string[]; connected: boolean }>("/health"),
  scan: () => call<{ devices: { address: string; name: string; rssi: number }[] }>("/scan"),
  connect: (address?: string) =>
    call<Status>("/connect", { method: "POST", body: JSON.stringify({ address }) }),
  disconnect: () => call<{ connected: boolean }>("/disconnect", { method: "POST" }),
  status: () => call<Status>("/status"),

  lighting: () => call<Lighting>("/lighting"),
  setLighting: (r: number, g: number, b: number, brightness = 255) =>
    call<Lighting>("/lighting", { method: "PUT", body: JSON.stringify({ r, g, b, brightness }) }),

  curves: (kind: "sticks" | "triggers") =>
    call<{ channels: Curve[] }>(`/curves/${kind}`),
  setCurves: (kind: "sticks" | "triggers", channels: Curve[]) =>
    call<{ channels: Curve[] }>(`/curves/${kind}`, {
      method: "PUT",
      body: JSON.stringify({ channels }),
    }),

  remap: () =>
    call<{ remaps: Record<string, number>; sources?: number[]; names?: Record<string, string> }>(
      "/remap",
    ),
  keys: () => call<{ names: Record<string, string> }>("/keys"),
  setRemap: (changes: Record<string, number>) =>
    call<{ remaps: Record<string, number> }>("/remap", {
      method: "PUT",
      body: JSON.stringify({ changes }),
    }),

  macros: () => call<{ macros: Record<string, Macro> }>("/macros"),
  macro: (slot: number) => call<Macro>(`/macros/${slot}`),
  setMacro: (slot: number, steps: { keys: string; hold_ms: number }[], loop_ms = 0) =>
    call<Macro>(`/macros/${slot}`, { method: "PUT", body: JSON.stringify({ steps, loop_ms }) }),
  clearMacro: (slot: number) => call<{ cleared: boolean }>(`/macros/${slot}`, { method: "DELETE" }),

  vibration: (percent: number) =>
    call<{ left: number; right: number }>("/vibration", {
      method: "POST",
      body: JSON.stringify({ percent }),
    }),

  input: (slot = 0) => call<InputState>(`/input?slot=${slot}`),
  rumble: (left = 1, right = 1, ms = 400, slot = 0) =>
    call<{ fired: boolean }>("/rumble", {
      method: "POST",
      body: JSON.stringify({ left, right, ms, slot }),
    }),

  backup: () => call<Record<string, unknown>>("/backup"),
  restore: (data: Record<string, unknown>) =>
    call<{ restored: boolean }>("/restore", { method: "POST", body: JSON.stringify(data) }),
};

export function watchStatus(onStatus: (s: Status) => void, onDown?: () => void): () => void {
  let ws: WebSocket | null = null;
  let closed = false;
  let retry: number | undefined;

  const open = () => {
    if (closed) return;
    ws = new WebSocket(ENGINE.replace("http", "ws") + "/events");
    ws.onmessage = (ev) => {
      try {
        onStatus(JSON.parse(ev.data) as Status);
      } catch {
        /* ignore malformed frame */
      }
    };
    ws.onclose = () => {
      onDown?.();
      if (!closed) retry = window.setTimeout(open, 2000);
    };
    ws.onerror = () => ws?.close();
  };

  open();
  return () => {
    closed = true;
    if (retry) window.clearTimeout(retry);
    ws?.close();
  };
}

/** Live XInput stream at ~30 Hz. Read-only: never touches the BLE link. */
export function watchInput(onState: (s: InputState) => void, onDown?: () => void): () => void {
  let ws: WebSocket | null = null;
  let closed = false;
  let retry: number | undefined;

  const open = () => {
    if (closed) return;
    ws = new WebSocket(ENGINE.replace("http", "ws") + "/input/ws");
    ws.onmessage = (ev) => {
      try {
        onState(JSON.parse(ev.data) as InputState);
      } catch {
        /* ignore malformed frame */
      }
    };
    ws.onclose = () => {
      onDown?.();
      if (!closed) retry = window.setTimeout(open, 2000);
    };
    ws.onerror = () => ws?.close();
  };

  open();
  return () => {
    closed = true;
    if (retry) window.clearTimeout(retry);
    ws?.close();
  };
}
