import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageTitle } from "@/components/layout/page-title";
import { EvidenceRecord } from "@/components/evidence/evidence-pair";
import { requireMember } from "@/lib/auth";
import { getStay } from "@/lib/db/stays";
import { evidencePairs } from "@/lib/db/photos";

export default async function RecordPage({ params }: { params: Promise<{ id: string }> }) {
  const [, { id }] = await Promise.all([requireMember(), params]);
  const stay = await getStay(id);
  // RLS hides other people's stays, so a miss means it is not theirs.
  if (!stay) notFound();

  const pairs = await evidencePairs(id);

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/requests"
        className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to requests
      </Link>

      <PageTitle
        title="Photo record"
        description="Each item as it was at check-in, and as it was at check-out."
      />

      <EvidenceRecord pairs={pairs} />
    </div>
  );
}
