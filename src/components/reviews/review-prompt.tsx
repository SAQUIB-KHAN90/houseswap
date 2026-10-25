"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReviewForm } from "@/components/reviews/review-form";

/**
 * The nudge on a settled stay. Collapsed until asked for, so a list of past
 * stays does not turn into a column of open forms.
 */
export function ReviewPrompt({ stayId, aboutName }: { stayId: string; aboutName: string }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Star aria-hidden />
        Write a review
      </Button>
    );
  }

  return (
    <div className="w-full rounded-lg border bg-page p-5">
      <ReviewForm stayId={stayId} aboutName={aboutName} onDone={() => setOpen(false)} />
    </div>
  );
}
