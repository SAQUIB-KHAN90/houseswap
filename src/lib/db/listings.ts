import { createClient } from "@/lib/supabase/server";
import type { AvailabilityRow, HostCardRow, ListingRow } from "@/types/db";
import type { OfferingType } from "@/lib/points/rates";

/**
 * A listing as the screens want it: the row, plus the host's public card.
 *
 * The host's completed-stay count is deliberately absent. `stay_requests` is
 * readable only by the two people on a stay, so a visitor cannot count another
 * member's stays, and the cards show the trust score alone.
 */
export type ListingView = {
  id: string;
  hostId: string;
  title: string;
  blurb: string;
  city: string;
  area: string;
  type: OfferingType;
  bedrooms: number;
  guests: number;
  amenities: string[];
  rules: string[];
  hostPresent: boolean;
  acceptsPoints: boolean;
  acceptsDirectSwap: boolean;
  pointsPerNight: number;
  depositInr: number;
  /** Rounded to about 100 m, and public. The exact address is not. */
  location: { latitude: number; longitude: number } | null;
  status: ListingRow["status"];
  host: { id: string; name: string; trust: number; verified: boolean; joined: string };
};

const joinedLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { month: "short", year: "numeric" });

function toListingView(row: ListingRow, host: HostCardRow | undefined): ListingView {
  return {
    id: row.id,
    hostId: row.host_id,
    title: row.title,
    blurb: row.description ?? "",
    city: row.city,
    area: row.area,
    type: row.offering,
    bedrooms: row.bedrooms,
    guests: row.max_guests,
    amenities: row.amenities,
    rules: row.house_rules,
    hostPresent: row.host_present,
    acceptsPoints: row.accepts_points,
    acceptsDirectSwap: row.accepts_direct_swap,
    pointsPerNight: row.points_per_night,
    depositInr: row.deposit_inr,
    location:
      row.approx_latitude != null && row.approx_longitude != null
        ? { latitude: row.approx_latitude, longitude: row.approx_longitude }
        : null,
    status: row.status,
    host: {
      id: host?.id ?? row.host_id,
      name: host?.full_name ?? "Host",
      trust: host?.trust_score ?? 0,
      verified: host?.kyc_status === "verified",
      joined: host ? joinedLabel(host.created_at) : "",
    },
  };
}

/**
 * Attaches host cards to listing rows.
 *
 * `host_cards` is a view, so PostgREST cannot be relied on to embed it from
 * `listings`. One extra query by host id is both predictable and cheap.
 */
export async function withHosts(rows: ListingRow[]): Promise<ListingView[]> {
  if (rows.length === 0) return [];
  const supabase = await createClient();
  const ids = [...new Set(rows.map((r) => r.host_id))];
  const { data, error } = await supabase.from("host_cards").select("*").in("id", ids);
  if (error) throw error;

  const byId = new Map((data as HostCardRow[] | null ?? []).map((h) => [h.id, h]));
  return rows.map((r) => toListingView(r, byId.get(r.host_id)));
}

export type SearchFilters = {
  city?: string;
  type?: OfferingType | "any";
  start?: string;
  end?: string;
  maxPoints?: number;
  /** Exact bedroom count, or a floor when `bedsOpenEnded` is set. */
  beds?: number;
  /** True for "4BHK and larger": `beds` becomes a minimum rather than a match. */
  bedsOpenEnded?: boolean;
};

/**
 * Active listings matching a trip. Dates narrow the result to listings with an
 * open availability window that covers the whole stay; the same check runs
 * again inside `request_stay`, which is what actually decides.
 */
export async function searchListings(filters: SearchFilters): Promise<ListingView[]> {
  return withHosts(await searchListingRows(filters));
}

/**
 * The listing rows for a search, before host cards are attached.
 *
 * Exposed separately so a caller that also wants cover photos can fetch both
 * from the same rows at the same time instead of waiting for one and then the
 * other. Each round trip to the database costs 250ms or more from India, so
 * the difference between two sequential calls and two parallel ones is
 * something a person notices.
 */
export async function searchListingRows(filters: SearchFilters): Promise<ListingRow[]> {
  const supabase = await createClient();
  const dated = Boolean(filters.start && filters.end && filters.end > filters.start);

  // With dates, the open window is an inner join rather than a second query:
  // one row of `availability` has to cover the whole stay, which is exactly
  // what an inner join with both bounds on the same embedded row means.
  let query = supabase
    .from("listings")
    .select(dated ? "*, availability!inner(starts_on, ends_on)" : "*")
    .eq("status", "active");

  if (dated) {
    query = query
      .lte("availability.starts_on", filters.start!)
      .gte("availability.ends_on", filters.end!);
  }

  if (filters.city) query = query.eq("city", filters.city);
  if (filters.type && filters.type !== "any") query = query.eq("offering", filters.type);
  if (filters.maxPoints) query = query.lte("points_per_night", filters.maxPoints);
  if (filters.beds) {
    query = filters.bedsOpenEnded
      ? query.gte("bedrooms", filters.beds)
      : query.eq("bedrooms", filters.beds);
  }

  const { data, error } = await query.order("points_per_night");
  if (error) throw error;

  // Through `unknown` because the select string is chosen at runtime, and the
  // client's type-level parser can only follow a literal one. The shape is
  // whichever of the two branches above ran.
  const raw = (data ?? []) as unknown as (ListingRow & { availability?: unknown })[];

  // The join adds an `availability` key to each row. Dropped here so callers
  // keep seeing a plain listing row.
  return raw.map(({ availability: _availability, ...row }) => row as ListingRow);
}

export async function getListingView(id: string): Promise<ListingView | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("listings").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const [view] = await withHosts([data as ListingRow]);
  return view;
}

/** The signed-in member's own listings, drafts and paused ones included. */
export async function myListings(hostId: string): Promise<ListingView[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("listings")
    .select("*")
    .eq("host_id", hostId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return withHosts((data ?? []) as ListingRow[]);
}

export async function listingAvailability(listingId: string): Promise<AvailabilityRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("availability")
    .select("*")
    .eq("listing_id", listingId)
    .order("starts_on");
  if (error) throw error;
  return (data ?? []) as AvailabilityRow[];
}

/** Revealed only once the host approves: the policy on `listing_addresses`. */
export async function listingAddress(listingId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("listing_addresses")
    .select("address_line, pincode")
    .eq("listing_id", listingId)
    .maybeSingle();
  return data as { address_line: string; pincode: string | null } | null;
}
