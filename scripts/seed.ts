/**
 * Fills a Supabase project with enough members and listings to use the app.
 *
 * Run it against a development project only: it creates confirmed auth users
 * with known passwords and marks them verified, which is not something that
 * should ever be possible in production.
 *
 *   npm run seed
 *
 * It needs SUPABASE_SERVICE_ROLE_KEY, because creating users and setting
 * `kyc_status` both bypass row-level security on purpose. Running it twice is
 * safe: members are matched by email and their listings are replaced.
 */
import { createClient } from "@supabase/supabase-js";
import { pointsPerNight, DEPOSIT_INR, type Amenity, type OfferingType } from "../src/lib/points/rates";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (they are in .env)."
  );
  process.exit(1);
}

const db = createClient(url, serviceKey, { auth: { persistSession: false } });

const PASSWORD = "houseswap-pilot";

type Seed = {
  email: string;
  name: string;
  city: string;
  staff?: boolean;
  trust: number;
  listing?: {
    title: string;
    description: string;
    area: string;
    offering: OfferingType;
    bedrooms: number;
    maxGuests: number;
    amenities: Amenity[];
    rules: string[];
    hostPresent: boolean;
    acceptsPoints: boolean;
    acceptsDirectSwap: boolean;
    address: string;
    /** Months ahead the listing is open, from the first of next month. */
    openMonths: number;
  };
};

const people: Seed[] = [
  {
    email: "meera@example.com",
    name: "Meera Kapoor",
    city: "Delhi",
    trust: 4.9,
    listing: {
      title: "Sunlit 2BHK near the park",
      description:
        "Second-floor flat opposite a small park. The balcony gets morning sun and the kitchen has everything you need to cook.",
      area: "Greater Kailash II",
      offering: "home",
      bedrooms: 2,
      maxGuests: 4,
      amenities: ["Wi-Fi", "Washing machine", "Full kitchen", "AC", "Parking"],
      rules: ["No parties", "Shoes off indoors", "Quiet after 10 pm"],
      hostPresent: false,
      acceptsPoints: true,
      acceptsDirectSwap: true,
      address: "C-14, second floor, GK II",
      openMonths: 4,
    },
  },
  {
    email: "arjun@example.com",
    name: "Arjun Malhotra",
    city: "Delhi",
    trust: 4.7,
    listing: {
      title: "Room with kitchen access",
      description:
        "A quiet room with its own desk, plus shared use of the kitchen. The metro is a six-minute walk.",
      area: "Saket",
      offering: "room_kitchen",
      bedrooms: 1,
      maxGuests: 2,
      amenities: ["Wi-Fi", "Kitchen access", "AC", "Workspace"],
      rules: ["No smoking", "Guests only after approval"],
      hostPresent: true,
      acceptsPoints: true,
      acceptsDirectSwap: false,
      address: "J-8, Saket",
      openMonths: 3,
    },
  },
  {
    email: "simran@example.com",
    name: "Simran Gill",
    city: "Chandigarh",
    trust: 4.8,
    listing: {
      title: "Compact 1BHK in the city centre",
      description: "Walk to Sector 17 plaza. Small, tidy, and easy to settle into for a week or more.",
      area: "Sector 17",
      offering: "home",
      bedrooms: 1,
      maxGuests: 2,
      amenities: ["Wi-Fi", "Washing machine", "Full kitchen", "AC"],
      rules: ["No pets", "No parties"],
      hostPresent: false,
      acceptsPoints: true,
      acceptsDirectSwap: true,
      address: "SCO 112, Sector 17",
      openMonths: 4,
    },
  },
  {
    email: "harpreet@example.com",
    name: "Harpreet Singh",
    city: "Chandigarh",
    trust: 4.6,
    listing: {
      title: "Private room in a family home",
      description:
        "Ground-floor room with its own bathroom. The family lives upstairs and keeps to themselves.",
      area: "Sector 35",
      offering: "room",
      bedrooms: 1,
      maxGuests: 1,
      amenities: ["Wi-Fi", "Attached bathroom", "Breakfast"],
      rules: ["Vegetarian kitchen", "Quiet after 10 pm"],
      hostPresent: true,
      acceptsPoints: true,
      acceptsDirectSwap: false,
      address: "House 1204, Sector 35",
      openMonths: 2,
    },
  },
  {
    email: "rohan@example.com",
    name: "Rohan Mathur",
    city: "Jaipur",
    trust: 4.9,
    listing: {
      title: "Spacious 3BHK with a terrace",
      description:
        "Room for a family or a small group. The terrace is the best place in the house after sunset.",
      area: "C-Scheme",
      offering: "home",
      bedrooms: 3,
      maxGuests: 6,
      amenities: ["Wi-Fi", "Washing machine", "Full kitchen", "AC", "Terrace", "Parking"],
      rules: ["No parties", "Remove shoes on the terrace"],
      hostPresent: false,
      acceptsPoints: true,
      acceptsDirectSwap: true,
      address: "19 Ashok Marg, C-Scheme",
      openMonths: 5,
    },
  },
  {
    email: "ananya@example.com",
    name: "Ananya Sharma",
    city: "Jaipur",
    trust: 4.8,
    listing: {
      title: "Bright room, shared kitchen",
      description:
        "Good for people working remotely. There is a proper desk and a window onto a quiet lane.",
      area: "Malviya Nagar",
      offering: "room_kitchen",
      bedrooms: 1,
      maxGuests: 2,
      amenities: ["Wi-Fi", "Kitchen access", "AC", "Workspace"],
      rules: ["No smoking", "Clean up after cooking"],
      hostPresent: true,
      acceptsPoints: false,
      acceptsDirectSwap: true,
      address: "B-42, Malviya Nagar",
      openMonths: 3,
    },
  },
  // The six above were the original pilot set. The rest fill out every
  // category in src/lib/categories.ts and every city, so the landing page has
  // something to show in each section rather than one home and a gap.
  {
    email: "kabir@example.com",
    name: "Kabir Anand",
    city: "Delhi",
    trust: 4.7,
    listing: {
      title: "Quiet 1BHK off the main road",
      description:
        "A one-bedroom flat on a lane with no through traffic. Small, warm, and five minutes from the metro.",
      area: "Lajpat Nagar",
      offering: "home",
      bedrooms: 1,
      maxGuests: 2,
      amenities: ["Wi-Fi", "Full kitchen", "AC", "Washing machine"],
      rules: ["No smoking indoors", "Quiet after 10 pm"],
      hostPresent: false,
      acceptsPoints: true,
      acceptsDirectSwap: true,
      address: "D-21, Lajpat Nagar II",
      openMonths: 4,
    },
  },
  {
    email: "farah@example.com",
    name: "Farah Qureshi",
    city: "Delhi",
    trust: 4.9,
    listing: {
      title: "Family 3BHK with a garden",
      description:
        "Ground floor with a small garden at the back. Three bedrooms, two bathrooms, and parking for one car.",
      area: "Vasant Kunj",
      offering: "home",
      bedrooms: 3,
      maxGuests: 6,
      amenities: [
        "Wi-Fi",
        "Full kitchen",
        "AC",
        "Washing machine",
        "Parking",
        "Child friendly",
      ],
      rules: ["No parties", "Shoes off indoors"],
      hostPresent: false,
      acceptsPoints: true,
      acceptsDirectSwap: false,
      address: "C-9, Vasant Kunj Sector B",
      openMonths: 5,
    },
  },
  {
    email: "vikram@example.com",
    name: "Vikram Sethi",
    city: "Delhi",
    trust: 4.8,
    listing: {
      title: "Large 4BHK for a group",
      description:
        "The whole floor, four bedrooms and a long balcony. Built for a family but it suits a group of friends just as well.",
      area: "Defence Colony",
      offering: "home",
      bedrooms: 4,
      maxGuests: 8,
      amenities: [
        "Wi-Fi",
        "Full kitchen",
        "AC",
        "Washing machine",
        "Parking",
        "Lift",
        "Terrace",
      ],
      rules: ["No parties", "No smoking indoors", "Quiet after 11 pm"],
      hostPresent: false,
      acceptsPoints: true,
      acceptsDirectSwap: true,
      address: "A-4, Defence Colony",
      openMonths: 3,
    },
  },
  {
    email: "nisha@example.com",
    name: "Nisha Bedi",
    city: "Chandigarh",
    trust: 4.7,
    listing: {
      title: "Bright 2BHK near the lake",
      description:
        "Ten minutes from Sukhna Lake. Two bedrooms, a proper dining table, and a balcony that catches the evening light.",
      area: "Sector 9",
      offering: "home",
      bedrooms: 2,
      maxGuests: 4,
      amenities: ["Wi-Fi", "Full kitchen", "AC", "Washing machine", "Parking"],
      rules: ["No parties", "Quiet after 10 pm"],
      hostPresent: false,
      acceptsPoints: true,
      acceptsDirectSwap: true,
      address: "House 284, Sector 9",
      openMonths: 4,
    },
  },
  {
    email: "gurpreet@example.com",
    name: "Gurpreet Kaur",
    city: "Chandigarh",
    trust: 4.9,
    listing: {
      title: "3BHK with a workspace",
      description:
        "Three bedrooms, one set up as a study with a desk and a good chair. Fast internet, and the market is a short walk.",
      area: "Sector 22",
      offering: "home",
      bedrooms: 3,
      maxGuests: 5,
      amenities: ["Wi-Fi", "Full kitchen", "AC", "Workspace", "Washing machine", "Lift"],
      rules: ["No smoking", "No pets"],
      hostPresent: false,
      acceptsPoints: true,
      acceptsDirectSwap: false,
      address: "SCO 44, Sector 22",
      openMonths: 3,
    },
  },
  {
    email: "deepak@example.com",
    name: "Deepak Rana",
    city: "Chandigarh",
    trust: 4.5,
    listing: {
      title: "Room with kitchen near the university",
      description:
        "A private room with its own entrance and use of the kitchen. Quiet street, mostly students and families.",
      area: "Sector 15",
      offering: "room_kitchen",
      bedrooms: 1,
      maxGuests: 2,
      amenities: ["Wi-Fi", "Kitchen access", "AC", "Workspace"],
      rules: ["No smoking", "Quiet after 10 pm"],
      hostPresent: true,
      acceptsPoints: true,
      acceptsDirectSwap: false,
      address: "House 1120, Sector 15",
      openMonths: 2,
    },
  },
  {
    email: "aarti@example.com",
    name: "Aarti Joshi",
    city: "Jaipur",
    trust: 4.8,
    listing: {
      title: "1BHK in the old city",
      description:
        "A compact flat inside the walled city, two minutes from a good chai stall. Noisy in the morning, lovely by evening.",
      area: "Bapu Bazaar",
      offering: "home",
      bedrooms: 1,
      maxGuests: 2,
      amenities: ["Wi-Fi", "Full kitchen", "AC"],
      rules: ["No parties", "Mind the stairs"],
      hostPresent: false,
      acceptsPoints: true,
      acceptsDirectSwap: true,
      address: "112 Bapu Bazaar",
      openMonths: 4,
    },
  },
  {
    email: "imran@example.com",
    name: "Imran Khan",
    city: "Jaipur",
    trust: 4.6,
    listing: {
      title: "2BHK near the station",
      description:
        "Handy for anyone arriving by train. Two bedrooms, a washing machine, and a lift that works.",
      area: "Sindhi Camp",
      offering: "home",
      bedrooms: 2,
      maxGuests: 4,
      amenities: ["Wi-Fi", "Full kitchen", "AC", "Washing machine", "Lift"],
      rules: ["No smoking indoors"],
      hostPresent: false,
      acceptsPoints: true,
      acceptsDirectSwap: false,
      address: "9 Station Road, Sindhi Camp",
      openMonths: 3,
    },
  },
  {
    email: "priya@example.com",
    name: "Priya Nair",
    city: "Jaipur",
    trust: 4.9,
    listing: {
      title: "Private room in a quiet house",
      description:
        "A room with its own bathroom at the back of the house. The family keeps to the front and breakfast is included.",
      area: "Vaishali Nagar",
      offering: "room",
      bedrooms: 1,
      maxGuests: 1,
      amenities: ["Wi-Fi", "Attached bathroom", "Breakfast", "AC"],
      rules: ["Vegetarian kitchen", "Quiet after 10 pm"],
      hostPresent: true,
      acceptsPoints: true,
      acceptsDirectSwap: false,
      address: "B-77, Vaishali Nagar",
      openMonths: 5,
    },
  },
  {
    email: "sahil@example.com",
    name: "Sahil Verma",
    city: "Delhi",
    trust: 4.4,
    listing: {
      title: "Single room near the metro",
      description:
        "Small, clean and cheap on points. Three minutes from the station, which is the whole point of it.",
      area: "Dwarka Sector 21",
      offering: "room",
      bedrooms: 1,
      maxGuests: 1,
      amenities: ["Wi-Fi", "Attached bathroom", "AC"],
      rules: ["No smoking", "No guests"],
      hostPresent: true,
      acceptsPoints: true,
      acceptsDirectSwap: false,
      address: "Flat 402, Dwarka Sector 21",
      openMonths: 2,
    },
  },
  // Enough in each category that a section is a row rather than a lone card.
  {
    email: "ritu@example.com",
    name: "Ritu Bansal",
    city: "Chandigarh",
    trust: 4.6,
    listing: {
      title: "1BHK beside the market",
      description:
        "One bedroom, a small balcony, and a vegetable market at the end of the road. Easy to live in for a week.",
      area: "Sector 44",
      offering: "home",
      bedrooms: 1,
      maxGuests: 2,
      amenities: ["Wi-Fi", "Full kitchen", "AC", "Lift"],
      rules: ["No smoking indoors", "Quiet after 10 pm"],
      hostPresent: false,
      acceptsPoints: true,
      acceptsDirectSwap: false,
      address: "House 3041, Sector 44C",
      openMonths: 3,
    },
  },
  {
    email: "manish@example.com",
    name: "Manish Tyagi",
    city: "Delhi",
    trust: 4.5,
    listing: {
      title: "2BHK with parking",
      description:
        "Second floor with covered parking, which matters here. Two bedrooms and a kitchen that gets used properly.",
      area: "Rohini Sector 9",
      offering: "home",
      bedrooms: 2,
      maxGuests: 4,
      amenities: ["Wi-Fi", "Full kitchen", "AC", "Parking", "Washing machine"],
      rules: ["No parties", "No pets"],
      hostPresent: false,
      acceptsPoints: true,
      acceptsDirectSwap: true,
      address: "Flat 204, Rohini Sector 9",
      openMonths: 4,
    },
  },
  {
    email: "shalini@example.com",
    name: "Shalini Rao",
    city: "Jaipur",
    trust: 4.7,
    listing: {
      title: "2BHK in a quiet colony",
      description:
        "Away from the tourist end of town. Two bedrooms, a terrace shared with one other flat, and very little noise.",
      area: "Mansarovar",
      offering: "home",
      bedrooms: 2,
      maxGuests: 4,
      amenities: ["Wi-Fi", "Full kitchen", "AC", "Terrace", "Washing machine"],
      rules: ["No smoking", "Quiet after 10 pm"],
      hostPresent: false,
      acceptsPoints: true,
      acceptsDirectSwap: false,
      address: "C-112, Mansarovar",
      openMonths: 5,
    },
  },
  {
    email: "jaspreet@example.com",
    name: "Jaspreet Dhillon",
    city: "Chandigarh",
    trust: 4.8,
    listing: {
      title: "3BHK near the gardens",
      description:
        "Three bedrooms on one floor, a short walk from the rose garden. Good for a family that wants space to spread out.",
      area: "Sector 11",
      offering: "home",
      bedrooms: 3,
      maxGuests: 6,
      amenities: [
        "Wi-Fi",
        "Full kitchen",
        "AC",
        "Washing machine",
        "Parking",
        "Child friendly",
      ],
      rules: ["No parties", "Shoes off indoors"],
      hostPresent: false,
      acceptsPoints: true,
      acceptsDirectSwap: true,
      address: "House 88, Sector 11A",
      openMonths: 4,
    },
  },
  {
    email: "anand@example.com",
    name: "Anand Pillai",
    city: "Jaipur",
    trust: 4.7,
    listing: {
      title: "4BHK haveli-style house",
      description:
        "An old house with a courtyard in the middle and four bedrooms around it. Cool in the afternoon, which matters here.",
      area: "Civil Lines",
      offering: "home",
      bedrooms: 4,
      maxGuests: 8,
      amenities: ["Wi-Fi", "Full kitchen", "AC", "Terrace", "Parking", "Washing machine"],
      rules: ["No parties", "Mind the courtyard plants"],
      hostPresent: false,
      acceptsPoints: true,
      acceptsDirectSwap: true,
      address: "7 Civil Lines",
      openMonths: 5,
    },
  },
  {
    email: "tanvi@example.com",
    name: "Tanvi Chopra",
    city: "Chandigarh",
    trust: 4.9,
    listing: {
      title: "4BHK with a garden and parking",
      description:
        "A whole house with a lawn at the front and room for two cars. Built for a large family and it shows.",
      area: "Sector 5",
      offering: "home",
      bedrooms: 4,
      maxGuests: 8,
      amenities: [
        "Wi-Fi",
        "Full kitchen",
        "AC",
        "Washing machine",
        "Parking",
        "Child friendly",
        "Workspace",
      ],
      rules: ["No parties", "No smoking indoors"],
      hostPresent: false,
      acceptsPoints: true,
      acceptsDirectSwap: false,
      address: "House 12, Sector 5",
      openMonths: 3,
    },
  },
  {
    email: "zoya@example.com",
    name: "Zoya Siddiqui",
    city: "Delhi",
    trust: 4.8,
    listing: {
      title: "5BHK for a large group",
      description:
        "Two floors, five bedrooms, three bathrooms. The most we have in the pilot, and priced accordingly.",
      area: "Greater Kailash I",
      offering: "home",
      bedrooms: 5,
      maxGuests: 10,
      amenities: [
        "Wi-Fi",
        "Full kitchen",
        "AC",
        "Washing machine",
        "Parking",
        "Lift",
        "Terrace",
      ],
      rules: ["No parties", "Quiet after 11 pm", "Shoes off indoors"],
      hostPresent: false,
      acceptsPoints: true,
      acceptsDirectSwap: true,
      address: "S-18, Greater Kailash I",
      openMonths: 4,
    },
  },
  {
    email: "neeraj@example.com",
    name: "Neeraj Gupta",
    city: "Delhi",
    trust: 4.6,
    listing: {
      title: "Room and kitchen near the university",
      description:
        "A room with a separate entrance and the run of the kitchen. Popular with people here for a few weeks of work.",
      area: "Hauz Khas",
      offering: "room_kitchen",
      bedrooms: 1,
      maxGuests: 2,
      amenities: ["Wi-Fi", "Kitchen access", "AC", "Workspace"],
      rules: ["No smoking", "Clean up after cooking"],
      hostPresent: true,
      acceptsPoints: true,
      acceptsDirectSwap: false,
      address: "J-14, Hauz Khas",
      openMonths: 3,
    },
  },
  {
    email: "lata@example.com",
    name: "Lata Menon",
    city: "Chandigarh",
    trust: 4.7,
    listing: {
      title: "Private room with its own bathroom",
      description:
        "Upstairs room at the back, with a bathroom nobody else uses. Breakfast if you want it, no obligation.",
      area: "Sector 40",
      offering: "room",
      bedrooms: 1,
      maxGuests: 1,
      amenities: ["Wi-Fi", "Attached bathroom", "Breakfast", "AC"],
      rules: ["No smoking", "Quiet after 10 pm"],
      hostPresent: true,
      acceptsPoints: true,
      acceptsDirectSwap: false,
      address: "House 2210, Sector 40C",
      openMonths: 4,
    },
  },
  { email: "staff@example.com", name: "Pilot Staff", city: "Delhi", trust: 5, staff: true },
];

const iso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Tomorrow. Seeded homes are open from then.
 *
 * It used to be the first of next month, which looked tidier and meant that
 * for most of a month the seeded data could not be booked at all: a search for
 * next week returned nothing, which reads as a broken app rather than as an
 * empty calendar. Opening from tomorrow keeps every window in the future and
 * makes the seed searchable the moment it finishes.
 */
function openFrom(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
}

/**
 * Existing members, by email, fetched once.
 *
 * This used to list every user again for each member in the seed, which is one
 * full round trip per person and turned a short script into several minutes.
 * The set only changes when this script creates somebody, so it is read once
 * and kept up to date as we go.
 */
let userIdByEmail: Map<string, string> | null = null;

async function loadUsers(): Promise<Map<string, string>> {
  if (userIdByEmail) return userIdByEmail;

  // listUsers is paged; the seed set is small enough for the first page.
  const { data, error } = await db.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) throw error;

  userIdByEmail = new Map(
    data.users.filter((u) => u.email).map((u) => [u.email as string, u.id])
  );
  return userIdByEmail;
}

async function findUserByEmail(email: string): Promise<string | null> {
  return (await loadUsers()).get(email) ?? null;
}

async function upsertMember(seed: Seed): Promise<string> {
  let id = await findUserByEmail(seed.email);

  if (!id) {
    const { data, error } = await db.auth.admin.createUser({
      email: seed.email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: seed.name },
    });
    if (error) throw error;
    id = data.user.id;
    // Keep the cache true, so a later lookup does not miss somebody this run
    // has just created.
    (await loadUsers()).set(seed.email, id);
  }

  // Insert unverified first, then verify: the starter-points trigger fires on a
  // change of kyc_status, so a row written straight to 'verified' earns nothing.
  const { error: profileError } = await db.from("profiles").upsert(
    {
      id,
      full_name: seed.name,
      email: seed.email,
      home_city: seed.city,
      trust_score: seed.trust,
      is_staff: Boolean(seed.staff),
    },
    { onConflict: "id" }
  );
  if (profileError) throw profileError;

  const { error: verifyError } = await db
    .from("profiles")
    .update({
      kyc_status: "verified",
      selfie_match: true,
      kyc_reference: `seed:${seed.email}`,
    })
    .eq("id", id)
    .neq("kyc_status", "verified");
  if (verifyError) throw verifyError;

  return id;
}

async function seedListing(hostId: string, seed: Seed): Promise<number | null> {
  if (!seed.listing) return null;
  const l = seed.listing;

  // Replace rather than add, so the script can be re-run without piling up
  // duplicate homes. Cascades take the address and the availability with it.
  const { error: clearError } = await db
    .from("listings")
    .delete()
    .eq("host_id", hostId)
    .eq("title", l.title);
  if (clearError) throw clearError;

  const rate = pointsPerNight({
    type: l.offering,
    bedrooms: l.bedrooms,
    amenities: l.amenities,
    city: seed.city,
  });

  const { data: created, error } = await db
    .from("listings")
    .insert({
      host_id: hostId,
      title: l.title,
      description: l.description,
      offering: l.offering,
      city: seed.city,
      area: l.area,
      bedrooms: l.bedrooms,
      max_guests: l.maxGuests,
      amenities: l.amenities,
      house_rules: l.rules,
      host_present: l.hostPresent,
      accepts_points: l.acceptsPoints,
      accepts_direct_swap: l.acceptsDirectSwap,
      points_per_night: rate,
      deposit_inr: DEPOSIT_INR[l.offering],
      status: "draft",
    })
    .select("id")
    .single();
  if (error) throw error;

  const listingId = (created as { id: string }).id;

  await db
    .from("listing_addresses")
    .insert({ listing_id: listingId, address_line: l.address });

  const start = openFrom();
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + l.openMonths);
  await db
    .from("availability")
    .insert({ listing_id: listingId, starts_on: iso(start), ends_on: iso(end) });

  // Going live through an update is what earns the first-listing bonus.
  const { error: liveError } = await db
    .from("listings")
    .update({ status: "active" })
    .eq("id", listingId);
  if (liveError) throw liveError;

  return rate;
}

async function main() {
  console.log(`Seeding ${url}\n`);

  for (const seed of people) {
    const id = await upsertMember(seed);
    const rate = await seedListing(id, seed);
    const role = seed.staff ? " (staff)" : "";
    console.log(
      rate === null
        ? `  ${seed.name}${role} — no listing`
        : `  ${seed.name}${role} — ${seed.listing!.title}, ${rate} points/night`
    );
  }

  console.log(`\nAll of them sign in with the password: ${PASSWORD}`);
  console.log("staff@example.com also sees /admin/disputes.");
}

main().catch((error) => {
  console.error("\nSeeding failed:", error.message ?? error);
  process.exit(1);
});
