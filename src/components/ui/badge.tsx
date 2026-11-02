import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-bold leading-4 transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-accent text-accent-foreground",
        secondary: "border-transparent bg-muted text-secondary-foreground",
        destructive: "border-transparent bg-error-subtle text-destructive-strong",
        success: "border-transparent bg-success-subtle text-success-strong",
        warning: "border-transparent bg-warning-subtle text-warning-strong",
        info: "border-transparent bg-info-subtle text-info-strong",
        solid: "border-transparent bg-primary text-primary-foreground",
        outline: "border-border bg-card text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
