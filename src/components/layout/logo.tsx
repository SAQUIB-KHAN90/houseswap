import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({ className, invert = false }: { className?: string; invert?: boolean }) {
  return (
    <Link
      href="/"
      className={cn("inline-flex shrink-0 items-center gap-2", className)}
      aria-label="HouseSwap home"
    >
      <svg viewBox="0 0 28 28" className="size-7" aria-hidden>
        <path
          d="M3.5 12.5 14 4l10.5 8.5"
          fill="none"
          stroke={invert ? "#fff" : "#13624e"}
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M8 16.5h12M8 16.5l3-3M20 16.5l-3 3"
          fill="none"
          stroke={invert ? "#fff" : "#13624e"}
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M8 22h12"
          fill="none"
          stroke={invert ? "rgba(255,255,255,.55)" : "#e0952b"}
          strokeWidth="2.4"
          strokeLinecap="round"
        />
      </svg>
      <span
        className={cn(
          "text-[19px] font-extrabold tracking-[-0.03em]",
          invert ? "text-white" : "text-ink"
        )}
      >
        houseswap
      </span>
    </Link>
  );
}
