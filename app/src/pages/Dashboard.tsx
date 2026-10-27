import { useState } from "react";
import { Download, Lightbulb, Vibrate } from "lucide-react";

import type { Status } from "@/lib/api";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { batteryPct } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Dashboard({
  status,
  onGoLights,
}: {
  status: Status | null;
  onGoLights: () => void;
}) {
  const { t } = useI18n();
  const [note, setNote] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const caps = status?.capabilities ?? {};
  const chips = [
    ["sticks", caps.sticks],
    ["triggers", caps.triggers],
    ["motors", caps.motors],
    ["turbo", caps.turbo],
    ["macros", caps.macros],
    ["remap", caps.changekey],
    ["lighting", caps.lighting],
  ].filter(([, v]) => typeof v === "number" && v > 0) as [string, number][];

  const vibrate = async () => {
    setBusy(true);
    try {
      const res = await api.vibration(60);
      setNote(`vibration ${res.left}% / ${res.right}%`);
    } catch (e) {
      setNote(String(e));
    } finally {
      setBusy(false);
    }
  };

  const backup = async () => {
    setBusy(true);
    try {
      const data = await api.backup();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `padstudio-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setNote("backup saved");
    } catch (e) {
      setNote(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <Card className="relative overflow-hidden">
        <div className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-violet/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-magenta/15 blur-3xl" />
        <CardContent className="relative flex flex-col gap-4 p-6">
          <div className="flex items-center gap-2">
            <Badge tone="accent">{status?.family ?? "keylinker"}</Badge>
            {status?.firmware && <Badge>{t("firmware")} {status.firmware}</Badge>}
            {status?.charging && <Badge tone="ok">charging</Badge>}
          </div>

          <div className="nice-shadow relative mx-auto w-full max-w-[520px]">
            <img
              src="/assets/controller-hero.png"
              alt="controller"
              className="w-full select-none drop-shadow-[0_25px_45px_rgba(168,85,247,0.35)]"
              draggable={false}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              [t("battery"), status?.battery ? `${batteryPct(status.battery)}%` : "—"],
              [t("model"), status?.model_id ?? "—"],
              [t("transport"), status?.transport ?? "—"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-line bg-panel2/60 px-3 py-2">
                <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
                <div className="truncate text-sm font-semibold">{value}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-5">
        <Card>
          <CardHeader>
            <CardTitle>{t("capabilities")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2 pt-1">
            {chips.length === 0 && <span className="text-xs text-muted">—</span>}
            {chips.map(([name, v]) => (
              <Badge key={name} tone="accent">
                {name} · {v}
              </Badge>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("quick_actions")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 pt-1 sm:grid-cols-2">
            <Button variant="secondary" onClick={onGoLights}>
              <Lightbulb className="h-4 w-4 text-violet" />
              {t("nav_lights")}
            </Button>
            <Button variant="secondary" onClick={vibrate} disabled={busy || !status?.connected}>
              <Vibrate className="h-4 w-4 text-magenta" />
              {t("test_vibration")}
            </Button>
            <Button variant="secondary" onClick={backup} disabled={busy || !status?.connected}>
              <Download className="h-4 w-4 text-cyan" />
              {t("backup")}
            </Button>
            {note && (
              <div className="col-span-full truncate rounded-lg border border-line bg-panel2/60 px-3 py-2 text-[11px] text-muted">
                {note}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
