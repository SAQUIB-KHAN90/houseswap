import { notFound } from "next/navigation";
import { ChecklistFlow } from "@/components/stays/checklist-flow";
import { requireMember } from "@/lib/auth";
import { getStay } from "@/lib/db/stays";
import { checklistRecord } from "@/lib/actions/checklists";

export default async function CheckOutPage({ params }: { params: Promise<{ id: string }> }) {
  const [member, { id }] = await Promise.all([requireMember(), params]);
  const stay = await getStay(id);
  if (!stay) notFound();

  const record = await checklistRecord(id);
  const mine = record.find((r) => r.phase === "checkout");
  const signed = Boolean(
    stay.guest_id === member.id ? mine?.signed_by_guest : mine?.signed_by_host
  );

  return <ChecklistFlow stayId={id} mode="checkout" alreadySigned={signed} />;
}
