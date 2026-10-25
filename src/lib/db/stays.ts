import { createClient } from "@/lib/supabase/server";
import type { HostCardRow, ListingRow, StayRequestRow } from "@/types/db";

/** A stay request with the listing it is for and the other party's name. */
export type StayView = StayRequestRow & {
  role: "guest" | "host";
  listing: Pick<ListingRow, "id" | "title" | "city" | "area" | "offering"> | null;
  /** The other person on the stay. */
  counterparty: { id: string; name: string } | null;
};

const OPEN_STATUSES = ["requested", "approved", "confirmed", "checked_in", "checked_out"] as const;

/**
 * Every stay the member is on, newest first, each tagged with whether they are
 * the guest or the host. RLS already limits the rows to their own.
 */
export async function myStays(memberId: string): Promise<StayView[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stay_requests")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;

  const rows = (data ?? []) as StayRequestRow[];
  if (rows.length === 0) return [];

  const listingIds = [...new Set(rows.map((r) => r.listing_id))];
  const partyIds = [
    ...new Set(rows.map((r) => (r.guest_id === memberId ? r.host_id : r.guest_id))),
  ];

  const [listings, hosts] = await Promise.all([
    supabase.from("listings").select("id, title, city, area, offering").in("id", listingIds),
    supabase.from("host_cards").select("*").in("id", partyIds),
  ]);
  if (listings.error) throw listings.error;
  if (hosts.error) throw hosts.error;

  const listingById = new Map(
    (listings.data as StayView["listing"][] | null ?? []).map((l) => [l!.id, l!])
  );
  const nameById = new Map(
    (hosts.data as HostCardRow[] | null ?? []).map((h) => [h.id, h.full_name])
  );

  return rows.map((r) => {
    const otherId = r.guest_id === memberId ? r.host_id : r.guest_id;
    return {
      ...r,
      role: r.guest_id === memberId ? "guest" : "host",
      listing: listingById.get(r.listing_id) ?? null,
      counterparty: { id: otherId, name: nameById.get(otherId) ?? "Member" },
    };
  });
}

/** Requests waiting on the member's reply as host. */
export function incomingRequests(stays: StayView[]): StayView[] {
  return stays.filter((s) => s.role === "host" && s.status === "requested");
}

/** Stays the member is travelling on, or has already taken. */
export function ownStays(stays: StayView[]): StayView[] {
  return stays.filter((s) => !(s.role === "host" && s.status === "requested"));
}

/** The statuses at which a guest has been told where the home is. */
const ADDRESS_VISIBLE = ["approved", "confirmed", "checked_in", "checked_out", "settled"];

export type StayAddress = { addressLine: string; pincode: string | null };

/**
 * Street addresses for the stays that have reached approval.
 *
 * The policy on `listing_addresses` is what actually decides: it returns a row
 * only to the host, or to a guest whose request the host has approved. The
 * status filter here just avoids asking for rows that will come back empty.
 */
export async function addressesForStays(
  stays: StayView[]
): Promise<Map<string, StayAddress>> {
  const visible = stays.filter(
    (s) => s.role === "guest" && ADDRESS_VISIBLE.includes(s.status)
  );
  if (visible.length === 0) return new Map();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("listing_addresses")
    .select("listing_id, address_line, pincode")
    .in("listing_id", [...new Set(visible.map((s) => s.listing_id))]);
  if (error) throw error;

  const byListing = new Map(
    ((data ?? []) as { listing_id: string; address_line: string; pincode: string | null }[]).map(
      (a) => [a.listing_id, { addressLine: a.address_line, pincode: a.pincode }]
    )
  );

  // Keyed by stay, not by listing: the same home can appear on two stays and
  // only the approved one should show an address.
  const byStay = new Map<string, StayAddress>();
  for (const stay of visible) {
    const address = byListing.get(stay.listing_id);
    if (address) byStay.set(stay.id, address);
  }
  return byStay;
}

export async function getStay(id: string): Promise<StayRequestRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stay_requests")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as StayRequestRow) ?? null;
}

/** Stays that can carry a conversation: anything not yet closed out. */
export async function stayThreads(memberId: string): Promise<StayView[]> {
  const stays = await myStays(memberId);
  return stays.filter((s) => (OPEN_STATUSES as readonly string[]).includes(s.status));
}
