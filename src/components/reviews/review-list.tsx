import { Rating } from "@/components/ui/rating";
import type { ReviewView } from "@/lib/db/reviews";

/**
 * Reviews about a member.
 *
 * The author's side is shown, because "as a host" and "as a guest" are two
 * different claims about the same person and a reader needs to know which one
 * they are reading.
 */
export function ReviewList({
  reviews,
  emptyMessage = "No reviews yet. They unlock when a stay settles.",
}: {
  reviews: ReviewView[];
  emptyMessage?: string;
}) {
  if (reviews.length === 0) {
    return <p className="rounded-lg border bg-surface p-8 text-center text-muted">{emptyMessage}</p>;
  }

  return (
    <ul className="space-y-3">
      {reviews.map((review) => (
        <li key={review.id} className="rounded-lg border bg-surface p-5">
          <div className="flex items-start justify-between gap-4">
            <p className="font-semibold">
              {review.authorName}
              <span className="font-normal text-muted">
                {" · "}
                {review.authorRole === "guest" ? "stayed with them" : "hosted them"}
              </span>
            </p>
            <Rating value={review.rating} className="shrink-0" />
          </div>
          {review.body && <p className="mt-2.5 leading-relaxed">{review.body}</p>}
          <p className="mt-2.5 text-sm text-muted">{review.date}</p>
        </li>
      ))}
    </ul>
  );
}
