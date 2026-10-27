import { useEffect, useState } from "react";
import { Check, Palette, RotateCcw, Sparkles } from "lucide-react";

import { api, type Status } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { hex } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";

const PRESETS: { name: string; rgb: [number, number, number] }[] = [
  { name: "Magenta", rgb: [236, 72, 153] },
  { name: "Violet", rgb: [168, 85, 247] },
  { name: "Cyan", rgb: [34, 211, 238] },
  { name: "Ice", rgb: [148, 200, 255] },
  { name: "Red", rgb: [255, 32, 32] },
  { name: "Amber", rgb: [255, 158, 11] },
  { name: "Lime", rgb: [163, 230, 53] },
  { name: "White", rgb: [255, 255, 255] },
  { name: "Off", rgb: [0, 0, 0] },
];

export default function Lights({ status }: { status: Status | null }) {
  const { t } = useI18n();
  const [rgb, setRgb] = useState<[number, number, number]>([236, 72, 153]);
  const [brightness, setBrightness] = useState(255);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>("");
  const [ok, setOk] = useState(false);

  const read = async () => {
    try {
      const light = await api.lighting();
      setRgb([light.r, light.g, light.b]);
      setBrightness(light.brightness ?? 255);
      setMsg("");
    } catch (e) {
      setMsg(String(e));
    }
  };

  useEffect(() => {
    if (status?.connected) void read();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status?.connected]);

  const apply = async () => {
    setBusy(true);
    setOk(false);
    try {
      const light = await api.setLighting(rgb[0], rgb[1], rgb[2], brightness);
      setRgb([light.r, light.g, light.b]);
      setOk(true);
      setMsg(`${t("saved")} · ${hex(light.r, light.g, light.b)}`);
    } catch (e) {
      setMsg(String(e));
    } finally {
      setBusy(false);
    }
  };

  const disabled = !status?.connected || busy;
  const color = hex(...rgb);

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <Card>
        <CardHeader>
          <CardTitle>{t("lighting_title")}</CardTitle>
          <p className="text-xs text-muted">{t("lighting_sub")}</p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="relative grid h-40 place-items-center overflow-hidden rounded-2xl border border-line bg-panel2/50">
            <div
              className="absolute inset-0 opacity-70 blur-2xl transition-colors duration-300"
              style={{ background: `radial-gradient(circle at 50% 55%, ${color} 0%, transparent 62%)` }}
            />
            <div
              className="relative h-24 w-24 rounded-full border border-white/20 transition-colors duration-300"
              style={{
                background: color,
                boxShadow: `0 0 60px ${color}, inset 0 0 24px rgba(0,0,0,0.45)`,
              }}
            />
            <span className="absolute bottom-3 right-4 font-mono text-[11px] uppercase tracking-widest text-white/70">
              {color}
            </span>
          </div>

          {(["R", "G", "B"] as const).map((channel, index) => (
            <div key={channel} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted">{channel}</span>
                <span className="font-mono tabular-nums">{rgb[index]}</span>
              </div>
              <Slider
                value={[rgb[index]]}
                max={255}
                step={1}
                onValueChange={([v]) => {
                  const next = [...rgb] as [number, number, number];
                  next[index] = v;
                  setRgb(next);
                }}
              />
            </div>
          ))}

          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted">{t("brightness")}</span>
              <span className="font-mono tabular-nums">{brightness}</span>
            </div>
            <Slider
              value={[brightness]}
              max={255}
              step={1}
              onValueChange={([v]) => setBrightness(v)}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={apply} disabled={disabled}>
              {ok ? <Check className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
              {busy ? t("applying") : t("apply")}
            </Button>
            <Button variant="ghost" onClick={read} disabled={disabled}>
              <RotateCcw className="h-4 w-4" />
              {t("restore")}
            </Button>
            {msg && <span className="truncate text-[11px] text-muted">{msg}</span>}
          </div>
        </CardContent>
      </Card>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle>
            <span className="inline-flex items-center gap-2">
              <Palette className="h-3.5 w-3.5 text-magenta" />
              {t("presets")}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-2 pt-1">
          {PRESETS.map((preset) => {
            const presetHex = hex(...preset.rgb);
            const active = presetHex === color;
            return (
              <button
                key={preset.name}
                title={preset.name}
                onClick={() => setRgb(preset.rgb)}
                className="group flex flex-col items-center gap-1 rounded-xl border border-line bg-panel2/50 p-2 transition-colors hover:border-violet/60"
              >
                <span
                  className="h-8 w-full rounded-lg border border-white/10"
                  style={{
                    background: presetHex,
                    boxShadow: active ? `0 0 16px ${presetHex}` : undefined,
                  }}
                />
                <span className="text-[10px] text-muted group-hover:text-ink">{preset.name}</span>
              </button>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
