import { StrictMode, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BatteryCharging,
  CircuitBoard,
  Gamepad2,
  Lightbulb,
  ListOrdered,
  RefreshCw,
  Repeat,
  Settings2,
  Sliders,
  Usb,
} from "lucide-react";

import "./index.css";
import { I18nProvider, useI18n } from "@/lib/i18n";
import { api, watchStatus, type Status } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, batteryPct } from "@/lib/utils";
import Curves from "@/pages/Curves";
import Dashboard from "@/pages/Dashboard";
import Lights from "@/pages/Lights";
import Macros from "@/pages/Macros";
import Placeholder from "@/pages/Placeholder";
import Remap from "@/pages/Remap";

type PageKey = "dashboard" | "lights" | "curves" | "remap" | "macros" | "settings";

function BatteryRing({ level, charging }: { level?: number | null; charging?: boolean | null }) {
  const pct = batteryPct(level);
  const R = 22;
  const C = 2 * Math.PI * R;
  return (
    <div className="relative grid h-14 w-14 place-items-center">
      <svg viewBox="0 0 56 56" className="absolute inset-0 -rotate-90">
        <circle cx="28" cy="28" r={R} fill="none" stroke="var(--color-line)" strokeWidth="5" />
        <circle
          cx="28"
          cy="28"
          r={R}
          fill="none"
          stroke="url(#batteryGradient)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={`${(pct / 100) * C} ${C}`}
          className="transition-all duration-500"
        />
        <defs>
          <linearGradient id="batteryGradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--color-violet)" />
            <stop offset="100%" stopColor="var(--color-magenta)" />
          </linearGradient>
        </defs>
      </svg>
      {charging ? (
        <BatteryCharging className="h-5 w-5 text-magenta" />
      ) : (
        <span className="text-[11px] font-semibold tabular-nums">{pct}%</span>
      )}
    </div>
  );
}

function App() {
  const { t, lang, setLang } = useI18n();
  const initial = (new URLSearchParams(location.search).get("page") ?? "dashboard") as PageKey;
  const [page, setPage] = useState<PageKey>(initial);
  const [status, setStatus] = useState<Status | null>(null);
  const [engineDown, setEngineDown] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const stop = watchStatus(
      (s) => {
        setEngineDown(false);
        setStatus(s);
      },
      () => setEngineDown(true),
    );
    api
      .status()
      .then((s) => setStatus(s))
      .catch(() => setEngineDown(true));
    return stop;
  }, []);

  const connect = async () => {
    setBusy(true);
    try {
      setStatus(await api.connect());
      setEngineDown(false);
    } catch {
      setEngineDown(true);
    } finally {
      setBusy(false);
    }
  };

  const nav = useMemo(
    () =>
      [
        { key: "dashboard", label: t("nav_dashboard"), icon: Gamepad2 },
        { key: "lights", label: t("nav_lights"), icon: Lightbulb },
        { key: "curves", label: t("nav_curves"), icon: Sliders },
        { key: "remap", label: t("nav_remap"), icon: Repeat },
        { key: "macros", label: t("nav_macros"), icon: ListOrdered },
        { key: "settings", label: t("nav_settings"), icon: Settings2 },
      ] as const,
    [t],
  );

  const connected = !!status?.connected;

  return (
    <div className="flex h-full min-h-0">
      {/* sidebar */}
      <aside className="flex w-[228px] shrink-0 flex-col border-r border-line/70 bg-panel/40 px-3 py-4">
        <div className="mb-6 flex items-center gap-2 px-2">
          <CircuitBoard className="h-6 w-6 text-violet" />
          <div className="leading-tight">
            <div className="text-sm font-bold tracking-[0.18em] accent-text">PADSTUDIO</div>
            <div className="text-[10px] uppercase tracking-widest text-muted">
              {status?.family ?? "controller studio"}
            </div>
          </div>
        </div>

        <nav className="flex flex-col gap-1">
          {nav.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setPage(key)}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors",
                page === key
                  ? "bg-panel2 text-ink shadow-[inset_0_0_0_1px_var(--color-line)]"
                  : "text-muted hover:bg-panel2/60 hover:text-ink",
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4 transition-colors",
                  page === key ? "text-violet" : "text-muted group-hover:text-ink",
                )}
              />
              {label}
              {page === key && <span className="ml-auto h-1.5 w-1.5 rounded-full accent-line" />}
            </button>
          ))}
        </nav>

        <div className="mt-auto space-y-3 px-1">
          <div className="flex items-center justify-between rounded-xl border border-line bg-panel2/60 px-3 py-2">
            <span className="text-[11px] uppercase tracking-wider text-muted">{t("battery")}</span>
            <span className="text-xs font-semibold">
              {status?.battery ? `${batteryPct(status.battery)}%` : "—"}
            </span>
          </div>
          <button
            onClick={() => setLang(lang === "en" ? "es" : "en")}
            className="w-full rounded-xl border border-line px-3 py-2 text-[11px] uppercase tracking-wider text-muted transition-colors hover:border-violet/50 hover:text-ink"
          >
            {lang === "en" ? "English" : "Español"} · switch
          </button>
        </div>
      </aside>

      {/* main */}
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-line/70 px-6 py-3">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold">
              {status?.name ?? "No controller"}
              <span className="ml-2 text-xs font-normal text-muted">
                {status?.model_id ? `${status.model_id} · fw ${status.firmware}` : ""}
              </span>
            </h1>
            <div className="flex items-center gap-2 text-[11px] text-muted">
              <Usb className="h-3 w-3" />
              {status?.transport ? `${status.transport} · ` : ""}
              {status?.capabilities?.macros ?? 0} macro slots
            </div>
          </div>

          <div className="ml-auto flex items-center gap-3">
            {engineDown ? (
              <Badge tone="warn">{t("engine_down")}</Badge>
            ) : (
              <Badge tone={connected ? "ok" : "warn"}>
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    connected ? "bg-emerald-400" : "animate-pulse bg-amber-400",
                  )}
                />
                {connected
                  ? t("connected")
                  : status?.auto?.retrying
                    ? t("reconnecting")
                    : t("disconnected")}
              </Badge>
            )}
            <BatteryRing level={status?.battery} charging={status?.charging} />
            <Button size="sm" variant="secondary" onClick={connect} disabled={busy}>
              <RefreshCw className={cn("h-3.5 w-3.5", busy && "animate-spin")} />
              {connected ? t("reconnect") : t("connect")}
            </Button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {page === "dashboard" && <Dashboard status={status} onGoLights={() => setPage("lights")} />}
          {page === "lights" && <Lights status={status} />}
          {page === "curves" && <Curves status={status} />}
          {page === "remap" && <Remap status={status} />}
          {page === "macros" && <Macros status={status} />}
          {page === "settings" && <Placeholder page={page} />}
        </div>
      </main>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </StrictMode>,
);
