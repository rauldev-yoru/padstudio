import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** rgb -> #rrggbb */
export function hex(r: number, g: number, b: number) {
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
}

/** Four-step battery gauge (1..4) to a 0..100 reading for display only. */
export function batteryPct(level?: number | null) {
  if (!level) return 0;
  return Math.round((level / 4) * 100);
}
