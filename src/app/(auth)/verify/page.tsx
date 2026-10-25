import { redirect } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { selfVerifyAllowed } from "@/lib/kyc/stand-in";
import { VerifyFlow } from "@/components/auth/verify-flow";
import { STARTER_POINTS } from "@/lib/points/rates";

export default async function VerifyPage() {
  const member = await requireMember();
  if (member.profile.kyc_status === "verified") redirect("/trip");

  return <VerifyFlow starterPoints={STARTER_POINTS} standInEnabled={selfVerifyAllowed()} />;
}
