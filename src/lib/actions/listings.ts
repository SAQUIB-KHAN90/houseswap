"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  AMENITIES,
  DEPOSIT_INR,
  pointsPerNight,
  type Amenity,
  type OfferingType,
} from "@/lib/points/rates";

export type ListingResult = { ok: true; id: string } | { ok: false; error: string };

const CITIES = ["Delhi", "Chandigarh", "Jaipur"];
const OFFERINGS: OfferingType[] = ["home", "room_kitchen", "room"];

/** Splits a textarea into one rule per non-empty line. */
function lines(value: string): string[] {
  return value
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

export type ListingInput = {
  title: string;
  description: string;
  offering: OfferingType;
  city: string;
  area: string;
  bedrooms: number;
  maxGuests: number;
  amenities: string[];
  houseRules: string;
  hostPresent: boolean;
  acceptsPoints: boolean;
  acceptsDirectSwap: boolean;
  addressLine: string;
  pincode: string;
  /** Roughly where it is, for the public map. Optional. */
  location: { latitude: number; longitude: number } | null;
  /** Open windows for the listing, each a pair of dates. */
  availability: { start: string; end: string }[];
};

/**
 * Publishes a listing.
 *
 * The nightly rate is computed here, by `pointsPerNight()`, and stored on the
 * row. Nothing in SQL recomputes it, so a later change to the rules never
 * reprices a listing that members have already booked against.
 *
 * The row is inserted as a draft and then set active, because the first-listing
 * bonus hangs off an update of `listings.status`; an insert straight to active
 * would skip the 25 points.
 */
export async function publishListing(input: ListingInput): Promise<ListingResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in first." };

  if (!input.title.trim()) return { ok: false, error: "Give your listing a title." };
  if (!input.area.trim()) return { ok: false, error: "Say which area it is in." };
  if (!CITIES.includes(input.city)) return { ok: false, error: "Choose one of the pilot cities." };
  if (!OFFERINGS.includes(input.offering)) return { ok: false, error: "Choose what you offer." };
  if (!input.acceptsPoints && !input.acceptsDirectSwap) {
    return { ok: false, error: "A listing has to be bookable by points, direct swap, or both." };
  }

  const amenities = input.amenities.filter((a): a is Amenity =>
    (AMENITIES as readonly string[]).includes(a)
  );
  const bedrooms = Math.min(20, Math.max(1, Math.floor(input.bedrooms) || 1));
  const maxGuests = Math.min(30, Math.max(1, Math.floor(input.maxGuests) || 2));

  const rate = pointsPerNight({
    type: input.offering,
    bedrooms,
    amenities,
    city: input.city,
  });

  const { data: created, error } = await supabase
    .from("listings")
    .insert({
      host_id: user.id,
      title: input.title.trim(),
      description: input.description.trim() || null,
      offering: input.offering,
      city: input.city,
      area: input.area.trim(),
      bedrooms,
      max_guests: maxGuests,
      amenities,
      house_rules: lines(input.houseRules),
      host_present: input.hostPresent,
      accepts_points: input.acceptsPoints,
      accepts_direct_swap: input.acceptsDirectSwap,
      points_per_night: rate,
      deposit_inr: DEPOSIT_INR[input.offering],
      // The database rounds these, so a crafted request cannot store a
      // precise point in a column the whole world can read.
      approx_latitude: input.location?.latitude ?? null,
      approx_longitude: input.location?.longitude ?? null,
      status: "draft",
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  const id = (created as { id: string }).id;

  if (input.addressLine.trim()) {
    // Kept in its own table so it stays hidden until the host approves a stay.
    await supabase.from("listing_addresses").insert({
      listing_id: id,
      address_line: input.addressLine.trim(),
      pincode: input.pincode.trim() || null,
    });
  }

  const windows = input.availability.filter((w) => w.start && w.end && w.end > w.start);
  if (windows.length > 0) {
    const { error: windowError } = await supabase.from("availability").insert(
      windows.map((w) => ({ listing_id: id, starts_on: w.start, ends_on: w.end }))
    );
    // The exclusion constraint refuses two overlapping windows on one listing.
    if (windowError) return { ok: false, error: windowError.message };
  }

  const { error: liveError } = await supabase
    .from("listings")
    .update({ status: "active" })
    .eq("id", id);
  if (liveError) return { ok: false, error: liveError.message };

  revalidatePath("/host");
  revalidatePath("/search");
  revalidatePath("/wallet");
  return { ok: true, id };
}

export async function setListingStatus(
  id: string,
  status: "active" | "paused"
): Promise<ListingResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("listings").update({ status }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/host");
  revalidatePath("/search");
  return { ok: true, id };
}

export async function addAvailability(
  listingId: string,
  start: string,
  end: string
): Promise<ListingResult> {
  if (!start || !end || end <= start) {
    return { ok: false, error: "Check-out has to be after check-in." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("availability")
    .insert({ listing_id: listingId, starts_on: start, ends_on: end });
  if (error) {
    return {
      ok: false,
      error: error.message.includes("availability_listing_id")
        ? "That overlaps a window you have already opened."
        : error.message,
    };
  }
  revalidatePath("/host");
  return { ok: true, id: listingId };
}

export async function removeAvailability(windowId: string): Promise<ListingResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("availability").delete().eq("id", windowId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/host");
  return { ok: true, id: windowId };
}
