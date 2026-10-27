import { useEffect, useMemo, useState } from "react";
import { Check, Eraser, Repeat } from "lucide-react";

import { api, type Status } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Remap({ status }: { status: Status | null }) {
  const { t } = useI18n();
  const [sources, setSources] = useState<number[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [current, setCurrent] = useState<Record<string, number>>({});
  const [draft, setDraft] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const label = (code: number) => names[String(code)] ?? `#${code}`;

  const load = async () => {
    try {
      const res = await api.remap();
      setSources(res.sources ?? []);
      setNames(res.names ?? {});
      setCurrent(res.remaps ?? {});
      setDraft({});
      setMsg("");
    } catch (e) {
      setMsg(String(e));
    }
  };

  useEffect(() => {
    if (status?.connected) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status?.connected]);

  const changes = useMemo(() => {
    const out: Record<string, number> = {};
    for (const src of sources) {
      const key = String(src);
      const value = draft[key] ?? current[key] ?? src;
      if (value !== src) out[key] = value;
    }
    return out;
  }, [draft, current, sources]);

  const apply = async () => {
    setBusy(true);
    try {
      const res = await api.setRemap(changes);
      setCurrent(res.remaps ?? {});
      setDraft({});
      setMsg(`saved · ${Object.keys(res.remaps ?? {}).length} active`);
    } catch (e) {
      setMsg(String(e));
    } finally {
      setBusy(false);
    }
  };

  const clearAll = async () => {
    setBusy(true);
    try {
      const res = await api.setRemap({});
      setCurrent(res.remaps ?? {});
      setDraft({});
      setMsg("all remaps cleared");
    } catch (e) {
      setMsg(String(e));
    } finally {
      setBusy(false);
    }
  };

  const disabled = !status?.connected || busy;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <Card>
        <CardHeader>
          <CardTitle>
            <span className="inline-flex items-center gap-2">
              <Repeat className="h-3.5 w-3.5 text-magenta" />
              button mapping
            </span>
          </CardTitle>
          <p className="text-xs text-muted">
            Pick what each button sends. Anything left alone keeps its normal job.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            {sources.map((src) => {
              const key = String(src);
              const value = draft[key] ?? current[key] ?? src;
              const changed = value !== src;
              return (
                <div
                  key={key}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${
                    changed ? "border-violet/60 bg-violet/10" : "border-line bg-panel2/50"
                  }`}
                >
                  <span className="w-16 shrink-0 truncate text-xs font-semibold">{label(src)}</span>
                  <span className="text-xs text-muted">→</span>
                  <select
                    value={value}
                    onChange={(e) => setDraft((prev) => ({ ...prev, [key]: Number(e.target.value) }))}
                    className="min-w-0 flex-1 rounded-lg border border-line bg-panel px-2 py-1 text-xs text-ink outline-none focus:border-violet/60"
                  >
                    <option value={src}>{label(src)} (default)</option>
                    {sources
                      .filter((candidate) => candidate !== src)
                      .map((candidate) => (
                        <option key={candidate} value={candidate}>
                          {label(candidate)}
                        </option>
                      ))}
                  </select>
                  {changed && <Badge tone="accent">changed</Badge>}
                </div>
              );
            })}
            {sources.length === 0 && (
              <div className="text-sm text-muted">
                {status?.connected ? "reading…" : t("disconnected")}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2">
            <Button onClick={apply} disabled={disabled || Object.keys(changes).length === 0}>
              <Check className="h-4 w-4" />
              apply {Object.keys(changes).length ? `(${Object.keys(changes).length})` : ""}
            </Button>
            <Button variant="ghost" onClick={clearAll} disabled={disabled}>
              <Eraser className="h-4 w-4" />
              clear all
            </Button>
            {msg && <span className="truncate text-[11px] text-muted">{msg}</span>}
          </div>
        </CardContent>
      </Card>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle>active on the pad</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 pt-1">
          {Object.keys(current).length === 0 && (
            <p className="text-xs text-muted">No remaps stored on the controller.</p>
          )}
          {Object.entries(current).map(([src, dst]) => (
            <div
              key={src}
              className="flex items-center justify-between rounded-lg border border-line bg-panel2/50 px-3 py-1.5 text-xs"
            >
              <span className="font-semibold">{label(Number(src))}</span>
              <span className="text-muted">→</span>
              <span className="font-semibold">{label(dst)}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
