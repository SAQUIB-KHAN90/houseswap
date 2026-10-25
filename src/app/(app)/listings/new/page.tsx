import { PageTitle } from "@/components/layout/page-title";
import { ListingForm } from "@/components/listings/listing-form";
import { requireVerifiedMember } from "@/lib/auth";

export default async function NewListingPage() {
  // request_stay and the trust model both assume a verified host.
  await requireVerifiedMember();

  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle
        title="List your home"
        description="Choose what you'll offer and how guests can book it. You approve every request before anyone arrives."
      />
      <ListingForm />
    </div>
  );
}
