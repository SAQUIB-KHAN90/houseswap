"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { submitReview } from "@/lib/actions/reviews";
import { cn } from "@/lib/utils";

const WORDS = ["", "Poor", "Below par", "Fine", "Good", "Excellent"];

/** Radio group, not buttons: a rating is one choice out of five. */
function Stars({
  value,
  onChange,
  disabled,
  name,
}: {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  name: string;
}) {
  return (
    <fieldset>
      <legend className="sr-only">Rating out of 5</legend>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className="cursor-pointer p-0.5">
            <input
              type="radio"
              name={name}
              value={n}
              checked={value === n}
              disabled={disabled}
              onChange={() => onChange(n)}
              className="peer sr-only"
            />
            <span className="sr-only">
              {n} {n === 1 ? "star" : "stars"}
            </span>
            <Star
              aria-hidden
              className={cn(
                "size-7 transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-brand",
                n <= value ? "fill-star text-star" : "text-field"
              )}
            />
          </label>
        ))}
        {value > 0 && <span className="ml-2 text-sm font-medium text-muted">{WORDS[value]}</span>}
      </div>
    </fieldset>
  );
}

export function ReviewForm({
  stayId,
  aboutName,
  onDone,
}: {
  stayId: string;
  aboutName: string;
  onDone?: () => void;
}) {
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function send() {
    setError(null);
    start(async () => {
      const result = await submitReview(stayId, rating, body);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onDone?.();
      router.refresh();
    });
  }

  return (
    <div className="space-y-3.5">
      <div>
        <p className="font-semibold">How was it, staying with {aboutName.split(" ")[0]}?</p>
        <p className="mt-0.5 text-sm text-muted">
          Both reviews are public once written. Say what the next person would want to know.
        </p>
      </div>

      <Stars name={`rating-${stayId}`} value={rating} onChange={setRating} disabled={pending} />

      <Textarea
        aria-label="Your review"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Was the home as described? Was it easy to coordinate?"
      />

      {error && (
        <p role="alert" className="text-sm text-alert">
          {error}
        </p>
      )}

      <Button disabled={pending || rating === 0} onClick={send}>
        {pending ? "Posting…" : "Post review"}
      </Button>
    </div>
  );
}
