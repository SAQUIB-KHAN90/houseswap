import { notFound } from "next/navigation";
import { ChecklistFlow } from "@/components/stays/checklist-flow";
import { requireMember } from "@/lib/auth";
import { getStay } from "@/lib/db/stays";
import { checklistRecord } from "@/lib/actions/checklists";

export default async function CheckInPage({ params }: { params: Promise<{ id: string }> }) {
  const [member, { id }] = await Promise.all([requireMember(), params]);
  const stay = await getStay(id);
  // RLS already hides other people's stays, so a miss means it is not theirs.
  if (!stay) notFound();

  const record = await checklistRecord(id);
  const mine = record.find((r) => r.phase === "checkin");
  const signed = Boolean(
    stay.guest_id === member.id ? mine?.signed_by_guest : mine?.signed_by_host
  );

  return <ChecklistFlow stayId={id} mode="checkin" alreadySigned={signed} />;
}
