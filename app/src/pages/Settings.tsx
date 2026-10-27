import { useEffect, useRef, useState } from "react";
import { Download, Info, RotateCcw, Save, Settings2, Upload, Vibrate } from "lucide-react";

import { api, type Status } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";

type SettingsPayload = {
  auto?: { enabled: boolean; failures: number; last_error: string };
  motor_strength?: number | null;
  shutdown_minutes?: number | null;
  motor_error?: string;
  shutdown_error?: string;
};

const SHUTDOWN_OPTIONS = [5, 10, 15, 25, 30, 60];

export default function SettingsPage({ status }: { status: Status | null }) {
  const { t } = useI18n();
  const [data, setData] = useState<SettingsPayload>({});
  const [strength, setStrength] = useState(80);
  const [shutdown, setShutdown] = useState(25);
  const [auto, setAuto] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    try {
      const res = (await fetch("http://127.0.0.1:8477/settings").then((r) => r.json())) as SettingsPayload;
      setData(res);
      if (typeof res.motor_strength === "number") setStrength(res.motor_strength);
      if (typeof res.shutdown_minutes === "number") setShutdown(res.shutdown_minutes);
      if (res.auto) setAuto(res.auto.enabled);
    } catch (e) {
      setMsg(String(e));
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status?.connected]);

  const save = async () => {
    setBusy(true);
    try {
      await fetch("http://127.0.0.1:8477/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motor_strength: strength, shutdown_minutes: shutdown }),
      });
      setMsg("saved to the controller");
      await load();
    } catch (e) {
      setMsg(String(e));
    } finally {
      setBusy(false);
    }
  };

  const toggleAuto = async (value: boolean) => {
    setAuto(value);
    await fetch("http://127.0.0.1:8477/auto", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: value }),
    }).catch(() => undefined);
  };

  const backup = async () => {
    setBusy(true);
    try {
      const payload = await api.backup();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `padstudio-backup-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMsg("backup downloaded");
    } catch (e) {
      setMsg(String(e));
    } finally {
      setBusy(false);
    }
  };

  const restore = async (file: File) => {
    setBusy(true);
    try {
      const parsed = JSON.parse(await file.text());
      await api.restore(parsed);
      setMsg(`restored from ${file.name}`);
      await load();
    } catch (e) {
      setMsg(String(e));
    } finally {
      setBusy(false);
    }
  };

  const disabled = !status?.connected || busy;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-5">
        <Card>
          <CardHeader>
            <CardTitle>
              <span className="inline-flex items-center gap-2">
                <Vibrate className="h-3.5 w-3.5 text-magenta" />
                motor strength
              </span>
            </CardTitle>
            <p className="text-xs text-muted">
              How hard the motors can shake. This is a stored level — use
              “Test vibration” on the dashboard to feel it.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted">strength</span>
              <span className="font-mono tabular-nums">{strength}%</span>
            </div>
            <Slider value={[strength]} max={100} step={1} onValueChange={([v]) => setStrength(v)} />
            {data.motor_error && (
              <p className="text-[10px] text-amber-300/80">read failed: {data.motor_error}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              <span className="inline-flex items-center gap-2">
                <RotateCcw className="h-3.5 w-3.5 text-cyan" />
                auto power-off
              </span>
            </CardTitle>
            <p className="text-xs text-muted">
              Minutes of inactivity before the pad sleeps. Sleeping is what drops the BLE link.
            </p>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {SHUTDOWN_OPTIONS.map((minutes) => (
              <Button
                key={minutes}
                size="sm"
                variant={shutdown === minutes ? "default" : "secondary"}
                onClick={() => setShutdown(minutes)}
              >
                {minutes} min
              </Button>
            ))}
            {typeof data.shutdown_minutes === "number" && (
              <Badge tone="accent">on pad: {data.shutdown_minutes} min</Badge>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={save} disabled={disabled}>
            <Save className="h-4 w-4" />
            {busy ? t("applying") : "save to controller"}
          </Button>
          <Button variant="ghost" onClick={load} disabled={busy}>
            <RotateCcw className="h-4 w-4" />
            reload
          </Button>
          {msg && <span className="truncate text-[11px] text-muted">{msg}</span>}
        </div>
      </div>

      <div className="space-y-5">
        <Card>
          <CardHeader>
            <CardTitle>connection</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold">auto-reconnect</div>
                <div className="text-[10px] text-muted">retries when the pad sleeps</div>
              </div>
              <Switch checked={auto} onCheckedChange={toggleAuto} />
            </div>
            {data.auto && (
              <p className="text-[10px] text-muted">
                failures: {data.auto.failures}
                {data.auto.last_error ? ` · last: ${data.auto.last_error.slice(0, 60)}` : ""}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>backup</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="secondary" className="w-full" onClick={backup} disabled={disabled}>
              <Download className="h-4 w-4" />
              download backup
            </Button>
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => fileRef.current?.click()}
              disabled={disabled}
            >
              <Upload className="h-4 w-4" />
              restore from file
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void restore(file);
                e.target.value = "";
              }}
            />
            <p className="text-[10px] text-muted">
              Lighting, curves, remaps and every macro slot in one JSON file.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              <span className="inline-flex items-center gap-2">
                <Info className="h-3.5 w-3.5 text-violet" />
                about
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-[11px] text-muted">
            <div className="flex justify-between">
              <span>engine</span>
              <span className="text-ink">0.1.0 · 127.0.0.1:8477</span>
            </div>
            <div className="flex justify-between">
              <span>controller</span>
              <span className="text-ink">{status?.model_id ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span>firmware</span>
              <span className="text-ink">{status?.firmware ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span>backend</span>
              <span className="text-ink">{status?.family ?? "—"}</span>
            </div>
            <p className="pt-2 text-[10px] leading-relaxed">
              GPL-3.0 · protocol research by X20CTL · not affiliated with Machenike or KeyLinker
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
