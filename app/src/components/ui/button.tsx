import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet/60",
  {
    variants: {
      variant: {
        default:
          "text-white shadow-lg shadow-violet/20 bg-[linear-gradient(92deg,var(--color-violet),var(--color-magenta))] hover:brightness-110",
        secondary:
          "bg-panel2 text-ink border border-line hover:border-violet/50 hover:bg-panel",
        ghost: "text-muted hover:text-ink hover:bg-panel2",
        outline: "border border-line text-ink hover:border-violet/60",
        danger: "bg-red-500/15 text-red-300 border border-red-500/30 hover:bg-red-500/25",
      },
      size: {
        default: "h-10 px-4",
        sm: "h-8 px-3 text-xs rounded-lg",
        lg: "h-12 px-6 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
  },
);
Button.displayName = "Button";
