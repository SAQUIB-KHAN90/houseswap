import { House } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Neutral placeholder shown while a photo loads, or if it fails to load.
 */
export function HomeArt({ className }: { className?: string; tone?: number; label?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "grid h-full w-full place-items-center bg-[linear-gradient(145deg,#eceae4,#dfdcd4)]",
        className
      )}
    >
      <House className="size-8 text-ink/20" />
    </div>
  );
}
