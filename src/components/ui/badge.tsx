import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-xs font-semibold [&_svg]:size-3.5",
  {
    variants: {
      variant: {
        default: "bg-ink/[0.06] text-ink",
        brand: "bg-brand-tint text-brand",
        solid: "bg-brand text-white",
        glass: "bg-white/95 text-ink shadow-sm backdrop-blur",
        star: "bg-star/15 text-[#8a5a10]",
        alert: "bg-alert/10 text-alert",
        outline: "border border-field text-ink",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
