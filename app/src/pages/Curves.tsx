import { useEffect, useMemo, useState } from "react";
import { Check, RotateCcw, Sliders } from "lucide-react";

import { api, type Curve, type Status } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";

type Kind = "sticks" | "triggers";

const SIDES = ["Left", "Right"];

/**
 * Response graph.
 *
 * The pad stores two control points plus two dead-zone bytes. Everything is
 * drawn on the raw 0-255 axis the controller itself uses, so the shape on screen
 * is the shape stored in hardware; nothing is re-interpreted.
 */
function CurveGraph({ curve }: { curve: Curve }) {
  const W = 260;
  const H = 140;
  const pad = 18;
  const max = curve.axis_max ?? 255;
  const sx = (v: number) => pad + (v / max) * (W - pad * 2);
  const sy = (v: number) => H - pad - (v / max) * (H - pad * 2);

  const points: [number, number][] = [
    [0, 0],
    [curve.point1[0], curve.point1[1]],
    [curve.point2[0], curve.point2[1]],
    [max, max],
  ];

  const path = points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${sx(x).toFixed(1)},${sy(y).toFixed(1)}`)
    .join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      <defs>
        <linearGradient id="curveGradient" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--color-violet)" />
          <stop offset="100%" stopColor="var(--color-magenta)" />
        </linearGradient>
      </defs>
      <rect x={pad} y={pad} width={W - pad * 2} height={H - pad * 2} fill="none" stroke="var(--color-line)" />
      {[0.25, 0.5, 0.75].map((g) => (
        <g key={g} stroke="var(--color-line)" strokeDasharray="3 4" opacity={0.55}>
          <line x1={pad + g * (W - pad * 2)} y1={pad} x2={pad + g * (W - pad * 2)} y2={H - pad} />
          <line x1={pad} y1={pad + g * (H - pad * 2)} x2={W - pad} y2={pad + g * (H - pad * 2)} />
        </g>
      ))}
      <line x1={sx(curve.inner_deadzone)} y1={pad} x2={sx(curve.inner_deadzone)} y2={H - pad} stroke="var(--color-cyan)" opacity={0.6} />
      <line x1={sx(curve.outer_raw ?? 0)} y1={pad} x2={sx(curve.outer_raw ?? 0)} y2={H - pad} stroke="var(--color-magenta)" opacity={0.6} />
      <path d={path} fill="none" stroke="url(#curveGradient)" strokeWidth={2.5} strokeLinecap="round" />
      {points.slice(1, 3).map(([x, y], i) => (
        <circle key={i} cx={sx(x)} cy={sy(y)} r={2.6} fill="var(--color-ink)" />
      ))}
      <text x={pad} y={H - 4} fontSize="8" fill="var(--color-muted)">{curve.inner_deadzone}</text>
      <text x={W - pad} y={H - 4} fontSize="8" fill="var(--color-muted)" textAnchor="end">{curve.outer_raw ?? 0}</text>
    </svg>
  );
}

export default function Curves({ status }: { status: Status | null }) {
  const { t } = useI18n();
  const [kind, setKind] = useState<Kind>("sticks");
  const [channels, setChannels] = useState<Record<Kind, Curve[]>>({ sticks: [], triggers: [] });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = async (which: Kind = kind) => {
    try {
      const res = await api.curves(which);
      setChannels((prev) => ({ ...prev, [which]: res.channels }));
      setMsg("");
    } catch (e) {
      setMsg(String(e));
    }
  };

  useEffect(() => {
    if (!status?.connected) return;
    void load("sticks");
    void load("triggers");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status?.connected]);

  const update = (index: number, patch: Partial<Curve>) => {
    setChannels((prev) => {
      const next = [...prev[kind]];
      next[index] = { ...next[index], ...patch };
      return { ...prev, [kind]: next };
    });
  };

  const apply = async () => {
    setBusy(true);
    try {
      const res = await api.setCurves(kind, channels[kind]);
      setChannels((prev) => ({ ...prev, [kind]: res.channels }));
      setMsg("saved");
    } catch (e) {
      setMsg(String(e));
    } finally {
      setBusy(false);
    }
  };

  const disabled = !status?.connected || busy;
  const current = useMemo(() => channels[kind] ?? [], [channels, kind]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {(["sticks", "triggers"] as Kind[]).map((k) => (
          <Button key={k} variant={kind === k ? "default" : "secondary"} size="sm" onClick={() => setKind(k)}>
            <Sliders className="h-3.5 w-3.5" />
            {k}
          </Button>
        ))}
        <Button variant="ghost" size="sm" onClick={() => load()} disabled={disabled}>
          <RotateCcw className="h-3.5 w-3.5" />
          reload
        </Button>
        <Button size="sm" onClick={apply} disabled={disabled || current.length === 0}>
          <Check className="h-3.5 w-3.5" />
          {busy ? t("applying") : t("apply")}
        </Button>
        {msg && <span className="truncate text-[11px] text-muted">{msg}</span>}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {current.map((curve, index) => (
          <Card key={index}>
            <CardHeader>
              <CardTitle>
                {SIDES[index] ?? `Channel ${index + 1}`} {kind === "sticks" ? "stick" : "trigger"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <CurveGraph curve={curve} />
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted">inner deadzone</span>
                  <span className="font-mono tabular-nums">{curve.inner_deadzone}</span>
                </div>
                <Slider value={[Math.min(curve.inner_deadzone, 60)]} max={60} step={1}
                  onValueChange={([v]) => update(index, { inner_deadzone: v })} />
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted">outer limit</span>
                  <span className="font-mono tabular-nums">{curve.outer_raw ?? 0}</span>
                </div>
                <Slider value={[Math.min(curve.outer_raw ?? 0, 120)]} max={120} step={1}
                  onValueChange={([v]) => update(index, { outer_raw: v })} />
              </div>
              <p className="text-[10px] text-muted/70">
                raw values as stored on the pad · axis 0–{curve.axis_max ?? 255}
              </p>
            </CardContent>
          </Card>
        ))}
        {current.length === 0 && (
          <Card className="lg:col-span-2">
            <CardContent className="p-5 text-sm text-muted">
              {status?.connected ? "reading…" : t("disconnected")}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
