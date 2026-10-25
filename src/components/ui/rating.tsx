import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function Rating({
  value,
  count,
  className,
}: {
  value: number;
  count?: number;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1 text-sm", className)}>
      <Star className="size-3.5 fill-star text-star" aria-hidden />
      <span className="font-semibold">{value.toFixed(1)}</span>
      {count !== undefined && <span className="text-muted">({count})</span>}
      <span className="sr-only">out of 5</span>
    </span>
  );
}
