import { useEffect, useRef, useState } from "react";
import { Radio } from "lucide-react";

import { watchInput, type InputState } from "@/lib/api";
import { Badge } from "@/components/ui/badge";

/** One stick: a square well with a dot that follows the real axis. */
function Stick({ label, x, y }: { label: string; x: number; y: number }) {
  const size = 116;
  const radius = 26;
  const cx = size / 2 + x * radius;
  const cy = size / 2 - y * radius;
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="relative rounded-full border border-line bg-panel2/60"
        style={{ width: size, height: size }}
      >
        <div className="absolute inset-0 rounded-full border border-line/50" style={{ margin: 18 }} />
        <div className="absolute left-1/2 top-1/2 h-px w-full -translate-x-1/2 -translate-y-1/2 bg-line/60" />
        <div className="absolute left-1/2 top-1/2 h-full w-px -translate-x-1/2 -translate-y-1/2 bg-line/60" />
        <div
          className="absolute h-3 w-3 rounded-full accent-line shadow-[0_0_12px_var(--color-violet)] transition-[left,top] duration-75"
          style={{ left: cx - 6, top: cy - 6 }}
        />
      </div>
      <span className="text-[10px] uppercase tracking-wider text-muted">{label}</span>
      <span className="font-mono text-[10px] text-muted">
        {x.toFixed(2)} / {y.toFixed(2)}
      </span>
    </div>
  );
}

/** One trigger: a horizontal bar, 0..1. */
function Trigger({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted">
        <span>{label}</span>
        <span className="font-mono">{Math.round(value * 100)}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full border border-line bg-panel2/60">
        <div
          className="h-full accent-line transition-[width] duration-75"
          style={{ width: `${Math.min(100, value * 100)}%` }}
        />
      </div>
    </div>
  );
}

export default function LiveInput({ active }: { active: boolean }) {
  const [state, setState] = useState<InputState | null>(null);
  const [down, setDown] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    if (!active) return;
    const stop = watchInput(
      (s) => {
        if (mounted.current) setState(s);
      },
      () => {
        if (mounted.current) setDown(true);
      },
    );
    return () => {
      mounted.current = false;
      stop();
    };
  }, [active]);

  const buttons = state?.buttons ?? [];
  const live = state?.connected && !down;

  return (
    <div className="glass rounded-2xl p-4">
      <div className="mb-3 flex items-center gap-2">
        <Radio className={`h-3.5 w-3.5 ${live ? "text-emerald-400" : "text-muted"}`} />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted">live input</span>
        {live ? (
          <Badge tone="ok">{state?.packet ? `packet ${state.packet}` : "streaming"}</Badge>
        ) : (
          <Badge tone="warn">{down ? "engine down" : "no controller on XInput"}</Badge>
        )}
        <span className="ml-auto text-[10px] text-muted/70">
          XInput · 30 Hz · read-only, does not touch the BLE link
        </span>
      </div>

      <div className="flex flex-wrap items-start gap-6">
        <Stick label="left" x={state?.left?.x ?? 0} y={state?.left?.y ?? 0} />
        <Stick label="right" x={state?.right?.x ?? 0} y={state?.right?.y ?? 0} />

        <div className="flex min-w-[180px] flex-1 flex-col justify-center gap-3 self-center">
          <Trigger label="LT" value={state?.triggers?.left ?? 0} />
          <Trigger label="RT" value={state?.triggers?.right ?? 0} />
        </div>

        <div className="flex min-w-[160px] max-w-[260px] flex-wrap content-start gap-1 self-center">
          {buttons.length === 0 && <span className="text-[11px] text-muted">no buttons pressed</span>}
          {buttons.map((b) => (
            <Badge key={b} tone="accent">
              {b}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
}
