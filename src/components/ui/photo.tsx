"use client";

import NextImage from "next/image";
import { useState } from "react";
import { HomeArt } from "@/components/listings/home-art";
import { cn } from "@/lib/utils";

/**
 * A photo that never looks broken: shows a neutral placeholder until the image
 * loads, and keeps it if the image fails.
 *
 * Goes through `next/image` rather than a bare `<img>`, which matters for more
 * than file size. The browser ends up requesting `/_next/image` on this app's
 * own origin, and the server fetches the real file. A network that blocks the
 * photo host — plenty do, and an ad blocker will do it too — then has nothing
 * to block: as far as the browser is concerned every picture comes from the
 * site it is already on.
 *
 * Hosts for remote images are allow-listed in next.config.ts, so this cannot
 * be turned into an open proxy for anything on the internet.
 */
export function Photo({
  src,
  alt,
  className,
  imgClassName,
  priority = false,
  sizes,
}: {
  src: string;
  alt: string;
  className?: string;
  imgClassName?: string;
  priority?: boolean;
  sizes?: string;
}) {
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");

  return (
    <div className={cn("relative h-full w-full overflow-hidden bg-[#eceae4]", className)}>
      {state !== "ok" && <HomeArt className="absolute inset-0" />}
      {state !== "error" && src && (
        <NextImage
          src={src}
          alt={alt}
          fill
          sizes={sizes ?? "100vw"}
          priority={priority}
          onLoad={() => setState("ok")}
          onError={() => setState("error")}
          className={cn(
            "object-cover transition-opacity duration-500",
            state === "ok" ? "opacity-100" : "opacity-0",
            imgClassName
          )}
        />
      )}
    </div>
  );
}
