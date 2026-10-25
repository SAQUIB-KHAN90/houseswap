import { createClient } from "@/lib/supabase/server";
import type { MessageRow } from "@/types/db";

export type ChatMessage = { id: string; mine: boolean; text: string; time: string };

const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

/** The conversation on one stay, oldest first. */
export async function stayMessages(stayId: string, memberId: string): Promise<ChatMessage[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("stay_id", stayId)
    .order("created_at");
  if (error) throw error;

  return ((data ?? []) as MessageRow[]).map((m) => ({
    id: m.id,
    mine: m.sender_id === memberId,
    text: m.body,
    time: clock(m.created_at),
  }));
}
