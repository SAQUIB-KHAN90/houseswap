"use client";

import { motion, useReducedMotion } from "framer-motion";
import { KeyRound } from "lucide-react";
import { HomeArt } from "@/components/listings/home-art";

function MiniCard({
  tone,
  city,
  title,
  pts,
}: {
  tone: number;
  city: string;
  title: string;
  pts: string;
}) {
  return (
    <div className="overflow-hidden rounded-lg bg-card shadow-[0_24px_60px_-20px_rgba(0,0,0,0.6)]">
      <div className="aspect-[16/10]">
        <HomeArt tone={tone} label={`${title} in ${city}`} />
      </div>
      <div className="flex items-center justify-between px-5 py-4">
        <div>
          <p className="text-xs text-muted-foreground">{city}</p>
          <p className="font-display text-base font-semibold text-ink">{title}</p>
        </div>
        <span className="rounded-full bg-haldi px-3 py-1 text-sm font-semibold text-ink">{pts}</span>
      </div>
    </div>
  );
}

export function SwapVisual() {
  const reduce = useReducedMotion();
  return (
    <div className="relative mx-auto h-[400px] w-full max-w-[520px] sm:h-[460px]" aria-hidden="true">
      <motion.div
        className="absolute left-0 top-0 w-[72%]"
        initial={reduce ? false : { opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <MiniCard tone={0} city="Delhi" title="Sunlit 2BHK" pts="48 / night" />
      </motion.div>
      <motion.div
        className="absolute bottom-0 right-0 w-[72%]"
        initial={reduce ? false : { opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
      >
        <MiniCard tone={1} city="Chandigarh" title="Compact 1BHK" pts="34 / night" />
      </motion.div>

      <motion.div
        className="absolute left-[58%] top-[34%] z-10 grid size-14 place-items-center rounded-full bg-primary text-white shadow-lg ring-4 ring-ink"
        initial={reduce ? false : { x: -90, y: -50, opacity: 0, rotate: -30 }}
        animate={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
        transition={{ delay: 0.9, duration: 0.9, type: "spring", bounce: 0.35 }}
      >
        <KeyRound className="size-6" />
      </motion.div>

      <motion.div
        className="absolute right-[6%] top-[18%] rounded-full bg-white px-4 py-2 text-sm font-semibold text-ink shadow-lg"
        initial={reduce ? false : { opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 1.6, duration: 0.4 }}
      >
        +48 points earned
      </motion.div>
    </div>
  );
}
