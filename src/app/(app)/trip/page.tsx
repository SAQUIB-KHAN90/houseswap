import { PageTitle } from "@/components/layout/page-title";
import { TripForm } from "@/components/listings/trip-form";

export default function TripPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle
        title="Where to next?"
        description="Tell us the route and dates. We'll show the homes that fit."
      />
      <TripForm />
    </div>
  );
}
