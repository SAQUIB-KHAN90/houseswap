"use client";

import { useRef, useState } from "react";
import { Camera, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type CapturedItem = {
  preview: string;
  storagePath: string;
  sha256: string;
  takenAt: string;
  latitude: number | null;
  longitude: number | null;
};

/**
 * One checklist item, and its photo.
 *
 * `capture="environment"` asks the phone for the rear camera rather than the
 * gallery picker. It is a hint, not a guarantee — a browser may still offer the
 * gallery, and a desktop certainly will — so this is not what makes the record
 * trustworthy. The timestamp, the geo-stamp and the hash are, and they are
 * recorded whichever way the file arrives.
 */
export function ItemCapture({
  label,
  captured,
  onCapture,
  disabled,
}: {
  label: string;
  captured: CapturedItem | undefined;
  onCapture: (file: File) => Promise<void>;
  disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handle(file: File | undefined) {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      await onCapture(file);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <li className="flex items-center justify-between gap-4 p-3.5">
      <div className="flex min-w-0 items-center gap-3">
        {captured && (
          <span className="size-11 shrink-0 overflow-hidden rounded-md border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={captured.preview} alt="" className="h-full w-full object-cover" />
          </span>
        )}
        <div className="min-w-0">
          <p className={cn("text-[15px]", captured && "text-muted")}>{label}</p>
          {error && (
            <p role="alert" className="text-xs text-alert">
              {error}
            </p>
          )}
        </div>
      </div>

      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => handle(e.target.files?.[0])}
      />
      <Button
        size="sm"
        variant={captured ? "outline" : "default"}
        aria-pressed={Boolean(captured)}
        disabled={disabled || busy}
        onClick={() => input.current?.click()}
      >
        {busy ? (
          <>
            <Loader2 className="animate-spin" />
            Saving
          </>
        ) : captured ? (
          <>
            <Check className="text-brand" />
            Retake
          </>
        ) : (
          <>
            <Camera />
            Take photo
          </>
        )}
      </Button>
    </li>
  );
}
