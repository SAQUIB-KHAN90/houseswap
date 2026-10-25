"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { setListingStatus } from "@/lib/actions/listings";
import type { ListingStatus } from "@/types/db";

/** Takes a listing off search, or puts it back on. */
export function ListingStatusButton({ id, status }: { id: string; status: ListingStatus }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const next = status === "active" ? "paused" : "active";

  function go() {
    setError(null);
    start(async () => {
      const result = await setListingStatus(id, next);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <>
      <Button variant="ghost" size="sm" onClick={go} disabled={pending}>
        {pending ? "…" : status === "active" ? "Pause listing" : "Make it live"}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-alert">
          {error}
        </p>
      )}
    </>
  );
}
