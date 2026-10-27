import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

/** English is the source language; Spanish is the first translation. */
const en = {
  nav_dashboard: "Dashboard",
  nav_lights: "Lighting",
  nav_curves: "Curves",
  nav_remap: "Remapping",
  nav_macros: "Macros",
  nav_settings: "Settings",
  connected: "Connected",
  disconnected: "Disconnected",
  connecting: "Connecting…",
  reconnecting: "Reconnecting…",
  battery: "Battery",
  firmware: "Firmware",
  model: "Model",
  transport: "Transport",
  capabilities: "Capabilities",
  quick_actions: "Quick actions",
  test_vibration: "Test vibration",
  backup: "Back up settings",
  restore: "Restore",
  lighting_title: "Lighting",
  lighting_sub: "Paint the pad. Changes are written to the controller and read back.",
  apply: "Apply to controller",
  applying: "Writing…",
  saved: "Saved",
  brightness: "Brightness",
  presets: "Presets",
  reconnect: "Reconnect",
  connect: "Connect",
  scan: "Scan",
  not_supported: "This controller does not expose that feature.",
  coming_soon: "Next phase",
  coming_soon_body:
    "This screen is designed and scheduled for the next phase. The engine already answers for it; only the interface is missing.",
  engine_down: "Engine not reachable on 127.0.0.1:8477",
};

type Key = keyof typeof en;

const es: Record<Key, string> = {
  nav_dashboard: "Panel",
  nav_lights: "Luces",
  nav_curves: "Curvas",
  nav_remap: "Remapeo",
  nav_macros: "Macros",
  nav_settings: "Ajustes",
  connected: "Conectado",
  disconnected: "Desconectado",
  connecting: "Conectando…",
  reconnecting: "Reconectando…",
  battery: "Batería",
  firmware: "Firmware",
  model: "Modelo",
  transport: "Transporte",
  capabilities: "Capacidades",
  quick_actions: "Acciones rápidas",
  test_vibration: "Probar vibración",
  backup: "Respaldar ajustes",
  restore: "Restaurar",
  lighting_title: "Luces",
  lighting_sub: "Pinta el mando. Los cambios se escriben y se releen del controlador.",
  apply: "Aplicar al mando",
  applying: "Escribiendo…",
  saved: "Guardado",
  brightness: "Brillo",
  presets: "Presets",
  reconnect: "Reconectar",
  connect: "Conectar",
  scan: "Buscar",
  not_supported: "Este controlador no expone esa función.",
  coming_soon: "Siguiente fase",
  coming_soon_body:
    "Esta pantalla está diseñada y agendada para la siguiente fase. El motor ya responde; falta solo la interfaz.",
  engine_down: "El motor no responde en 127.0.0.1:8477",
};

const dictionaries = { en, es } as const;
export type Lang = keyof typeof dictionaries;

type Ctx = { lang: Lang; t: (k: Key) => string; setLang: (l: Lang) => void };

const I18nContext = createContext<Ctx>({ lang: "en", t: (k) => en[k], setLang: () => {} });

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>("en");
  const t = useCallback((k: Key) => dictionaries[lang][k] ?? en[k], [lang]);
  const value = useMemo(() => ({ lang, t, setLang }), [lang, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
