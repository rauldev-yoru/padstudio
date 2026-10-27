import { Construction } from "lucide-react";

import { useI18n } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const TITLES: Record<string, string> = {
  curves: "Stick & trigger curves",
  remap: "Button remapping",
  macros: "Macro timeline",
  settings: "Settings",
};

const DETAIL: Record<string, string> = {
  curves: "Response graph with draggable points, per-stick dead zones and a live dot from the real stick.",
  remap: "Click a button on the controller drawing and pick what it should send instead.",
  macros: "Step timeline: button chord + hold time per row, loop interval, assign to M1–M4 and test.",
  settings: "Vibration strength, shutdown timeout, backup / restore, autostart and widget preferences.",
};

export default function Placeholder({ page }: { page: string }) {
  const { t } = useI18n();
  return (
    <Card className="mx-auto mt-10 max-w-xl">
      <CardHeader>
        <CardTitle>
          <span className="inline-flex items-center gap-2">
            <Construction className="h-4 w-4 text-magenta" />
            {t("coming_soon")}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <h2 className="text-xl font-semibold">{TITLES[page] ?? page}</h2>
        <p className="text-sm text-muted">{DETAIL[page] ?? t("coming_soon_body")}</p>
        <p className="text-xs text-muted/80">{t("coming_soon_body")}</p>
      </CardContent>
    </Card>
  );
}
