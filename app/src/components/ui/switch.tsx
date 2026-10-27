import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

export const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    className={cn(
      "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet/60 data-[state=checked]:bg-[linear-gradient(92deg,var(--color-violet),var(--color-magenta))] data-[state=unchecked]:bg-panel2 border-line",
      className,
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb className="pointer-events-none block h-4 w-4 rounded-full bg-ink shadow transition-transform data-[state=checked]:translate-x-6 data-[state=unchecked]:translate-x-1" />
  </SwitchPrimitive.Root>
));
Switch.displayName = "Switch";
