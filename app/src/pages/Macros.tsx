import { useEffect, useState } from "react";
import { Check, CirclePlus, ListOrdered, Play, RotateCcw, Trash2 } from "lucide-react";

import { api, type Macro, type Status } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";

type Row = { keys: string; hold_ms: number };

const SLOTS = [1, 2, 3, 4];

export default function Macros({ status }: { status: Status | null }) {
  const { t } = useI18n();
  const [slot, setSlot] = useState(1);
  const [rows, setRows] = useState<Row[]>([{ keys: "A", hold_ms: 100 }]);
  const [loop, setLoop] = useState(0);
  const [stored, setStored] = useState<Macro | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const read = async (which = slot) => {
    try {
      const macro = await api.macro(which);
      setStored(macro);
      if (macro.steps?.length) {
        setRows(
          macro.steps.map((step) => ({
            keys: Array.isArray(step.keys) ? step.keys.join("+") : step.keys || "",
            hold_ms: step.hold_ms,
          })),
        );
        setLoop(macro.loop_ms ?? 0);
      } else {
        setRows([{ keys: "A", hold_ms: 100 }]);
        setLoop(0);
      }
      setMsg("");
    } catch (e) {
      setMsg(String(e));
    }
  };

  useEffect(() => {
    if (status?.connected) void read(slot);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status?.connected, slot]);

  const write = async () => {
    setBusy(true);
    try {
      const macro = await api.setMacro(slot, rows.filter((r) => r.keys.trim()), loop);
      setStored(macro);
      setMsg("written and read back");
    } catch (e) {
      setMsg(String(e));
    } finally {
      setBusy(false);
    }
  };

  const clear = async () => {
    setBusy(true);
    try {
      await api.clearMacro(slot);
      setStored(null);
      setRows([{ keys: "A", hold_ms: 100 }]);
      setMsg("slot cleared");
    } catch (e) {
      setMsg(String(e));
    } finally {
      setBusy(false);
    }
  };

  const disabled = !status?.connected || busy;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
      <Card>
        <CardHeader>
          <CardTitle>
            <span className="inline-flex items-center gap-2">
              <ListOrdered className="h-3.5 w-3.5 text-violet" />
              macro timeline · slot {slot}
            </span>
          </CardTitle>
          <p className="text-xs text-muted">
            One row is one step in time. <span className="text-ink">A+B</span> presses both buttons
            together, <span className="text-ink">hold</span> is how long they stay down before the
            next step starts.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {SLOTS.map((s) => (
              <Button
                key={s}
                size="sm"
                variant={slot === s ? "default" : "secondary"}
                onClick={() => setSlot(s)}
              >
                M{s}
              </Button>
            ))}
            <Button size="sm" variant="ghost" onClick={() => read()} disabled={disabled}>
              <RotateCcw className="h-3.5 w-3.5" />
              read
            </Button>
          </div>

          <div className="space-y-2">
            {rows.map((row, index) => (
              <div
                key={index}
                className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-panel2/50 px-3 py-2"
              >
                <span className="w-6 shrink-0 text-center text-[11px] font-semibold text-muted">
                  {index + 1}
                </span>
                <input
                  value={row.keys}
                  onChange={(e) =>
                    setRows((prev) =>
                      prev.map((r, i) => (i === index ? { ...r, keys: e.target.value } : r)),
                    )
                  }
                  placeholder="A+B"
                  className="w-28 rounded-lg border border-line bg-panel px-2 py-1 text-xs outline-none focus:border-violet/60"
                />
                <span className="text-[11px] text-muted">hold</span>
                <input
                  type="number"
                  min={5}
                  step={5}
                  value={row.hold_ms}
                  onChange={(e) =>
                    setRows((prev) =>
                      prev.map((r, i) =>
                        i === index ? { ...r, hold_ms: Number(e.target.value) } : r,
                      ),
                    )
                  }
                  className="w-20 rounded-lg border border-line bg-panel px-2 py-1 text-xs tabular-nums outline-none focus:border-violet/60"
                />
                <span className="text-[11px] text-muted">ms</span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="ml-auto h-7 w-7"
                  onClick={() => setRows((prev) => prev.filter((_, i) => i !== index))}
                  disabled={rows.length === 1}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setRows((prev) => [...prev, { keys: "B", hold_ms: 100 }])}
            >
              <CirclePlus className="h-3.5 w-3.5" />
              add step
            </Button>
            <div className="ml-auto flex min-w-[200px] items-center gap-2">
              <span className="text-[11px] text-muted">loop</span>
              <Slider value={[loop]} max={2000} step={50} onValueChange={([v]) => setLoop(v)} />
              <span className="w-14 text-right text-[11px] tabular-nums">{loop} ms</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button onClick={write} disabled={disabled}>
              <Check className="h-4 w-4" />
              {busy ? t("applying") : "write to pad"}
            </Button>
            <Button variant="ghost" onClick={clear} disabled={disabled}>
              <Trash2 className="h-4 w-4" />
              clear slot
            </Button>
            {msg && <span className="truncate text-[11px] text-muted">{msg}</span>}
          </div>
        </CardContent>
      </Card>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle>
            <span className="inline-flex items-center gap-2">
              <Play className="h-3.5 w-3.5 text-magenta" />
              stored on the pad
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 pt-1">
          {!stored || stored.steps.length === 0 ? (
            <p className="text-xs text-muted">Slot M{slot} is empty.</p>
          ) : (
            <>
              {stored.steps.map((step, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg border border-line bg-panel2/50 px-3 py-1.5 text-xs"
                >
                  <span className="font-semibold">
                    {Array.isArray(step.keys)
                      ? step.keys.join("+") || (stored.masks?.[i] ? `mask ${stored.masks[i]}` : "—")
                      : step.keys}
                  </span>
                  <span className="text-muted">{step.hold_ms} ms</span>
                </div>
              ))}
              {stored.loop_ms > 0 && (
                <Badge tone="accent">loop every {stored.loop_ms} ms</Badge>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
