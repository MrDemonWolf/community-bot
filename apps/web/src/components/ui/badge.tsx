import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-brand-main/50 focus:ring-offset-2 select-none",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-brand-main text-white",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground",
        destructive:
          "border-transparent bg-destructive/10 text-destructive dark:bg-destructive/20",
        outline: "text-foreground border-border",
        broadcaster:
          "border-transparent bg-amber-500/15 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400",
        "lead-moderator":
          "border-transparent bg-blue-500/15 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400",
        moderator:
          "border-transparent bg-green-500/15 text-green-700 dark:bg-green-500/20 dark:text-green-400",
        user:
          "border-transparent bg-muted text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
