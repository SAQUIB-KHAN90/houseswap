/**
 * Row shapes for the tables in supabase/migrations.
 *
 * Written by hand rather than generated, so the app does not depend on the
 * Supabase CLI being installed. If a migration changes a column, change it
 * here in the same commit.
 */
import type { OfferingType } from "@/lib/points/rates";

export type KycStatus = "unverified" | "pending" | "verified" | "rejected";
export type ListingStatus = "draft" | "active" | "paused";
export type StayMode = "points" | "direct";

export type StayStatus =
  | "requested"
  | "approved"
  | "confirmed"
  | "checked_in"
  | "checked_out"
  | "settled"
  | "declined"
  | "cancelled"
  | "disputed";

export type LedgerKind =
  | "starter_bonus"
  | "listing_bonus"
  | "topup"
  | "stay_spent"
  | "stay_earned"
  | "swap_settlement"
  | "dispute_adjustment"
  | "admin_adjustment";

export type DepositStatus = "none" | "pending" | "held" | "released" | "forfeited";

export type ProfileRow = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  home_city: string | null;
  kyc_status: KycStatus;
  kyc_reference: string | null;
  selfie_match: boolean;
  trust_score: number | null;
  is_staff: boolean;
  notify_email: boolean;
  notify_whatsapp: boolean;
  notify_sms: boolean;
  phone_verified: boolean;
  suspended_at: string | null;
  suspended_reason: string | null;
  created_at: string;
};

/** The public face of a profile: the `host_cards` view, with no contact details. */
export type HostCardRow = {
  id: string;
  full_name: string;
  home_city: string | null;
  trust_score: number | null;
  kyc_status: KycStatus;
  created_at: string;
};

export type ListingRow = {
  id: string;
  host_id: string;
  title: string;
  description: string | null;
  offering: OfferingType;
  city: string;
  area: string;
  bedrooms: number;
  max_guests: number;
  amenities: string[];
  house_rules: string[];
  host_present: boolean;
  accepts_points: boolean;
  accepts_direct_swap: boolean;
  points_per_night: number;
  deposit_inr: number;
  approx_latitude: number | null;
  approx_longitude: number | null;
  status: ListingStatus;
  created_at: string;
  updated_at: string;
};

export type AvailabilityRow = {
  id: string;
  listing_id: string;
  starts_on: string;
  ends_on: string;
};

export type StayRequestRow = {
  id: string;
  listing_id: string;
  guest_id: string;
  host_id: string;
  mode: StayMode;
  starts_on: string;
  ends_on: string;
  nights: number;
  points_per_night: number;
  points_total: number;
  points_held: number;
  paired_request_id: string | null;
  swap_points_delta: number;
  deposit_inr: number;
  deposit_state: DepositStatus;
  payment_reference: string | null;
  status: StayStatus;
  rules_accepted_at: string | null;
  checked_out_at: string | null;
  created_at: string;
  updated_at: string;
};

export type LedgerRow = {
  id: number;
  user_id: string;
  delta: number;
  kind: LedgerKind;
  stay_id: string | null;
  note: string | null;
  created_at: string;
};

export type MessageRow = {
  id: string;
  stay_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

export type DisputeRow = {
  id: string;
  stay_id: string;
  raised_by: string;
  description: string;
  status: "open" | "in_review" | "resolved" | "rejected";
  resolution: string | null;
  points_moved: number;
  resolved_by: string | null;
  created_at: string;
  resolved_at: string | null;
};

/** What `my_points()` and `points_balance()` return. */
export type PointsBalance = { settled: number; held: number; available: number };
