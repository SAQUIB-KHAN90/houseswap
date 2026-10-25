"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ArrowLeftRight, DoorOpen, Home, KeyRound, Utensils } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PhotoPicker, type PickedPhoto } from "@/components/listings/photo-picker";
import { LocationPicker, type Point } from "@/components/map/location-picker";
import { publishListing } from "@/lib/actions/listings";
import { saveListingPhotos } from "@/lib/actions/photos";
import { uploadListingPhoto } from "@/lib/photos/upload";
import {
  AMENITIES,
  DEPOSIT_INR,
  pointsPerNight,
  type Amenity,
  type OfferingType,
} from "@/lib/points/rates";
import { cn } from "@/lib/utils";

const options: { v: OfferingType; icon: typeof Home; t: string; d: string }[] = [
  { v: "home", icon: Home, t: "Entire home", d: "You're away. Guests get the whole place." },
  {
    v: "room_kitchen",
    icon: Utensils,
    t: "Room + kitchen",
    d: "A private room and kitchen access.",
  },
  { v: "room", icon: DoorOpen, t: "Private room", d: "A room with shared living spaces." },
];

const cities = ["Delhi", "Chandigarh", "Jaipur"];

export function ListingForm() {
  const [offering, setOffering] = useState<OfferingType>("home");
  const [title, setTitle] = useState("");
  const [city, setCity] = useState("Delhi");
  const [area, setArea] = useState("");
  const [bedrooms, setBedrooms] = useState(1);
  const [maxGuests, setMaxGuests] = useState(2);
  const [description, setDescription] = useState("");
  const [amenities, setAmenities] = useState<Amenity[]>([]);
  const [houseRules, setHouseRules] = useState("");
  const [hostPresent, setHostPresent] = useState(false);
  const [acceptsPoints, setAcceptsPoints] = useState(true);
  const [acceptsSwap, setAcceptsSwap] = useState(false);
  const [addressLine, setAddressLine] = useState("");
  const [pincode, setPincode] = useState("");
  const [location, setLocation] = useState<Point | null>(null);
  const [openFrom, setOpenFrom] = useState("");
  const [openUntil, setOpenUntil] = useState("");

  const [photos, setPhotos] = useState<PickedPhoto[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const rate = useMemo(
    () => pointsPerNight({ type: offering, bedrooms, amenities, city }),
    [offering, bedrooms, amenities, city]
  );

  const noMode = !acceptsPoints && !acceptsSwap;

  // A private room is one room by definition, so the count does not apply.
  const bedroomsApply = offering !== "room";

  function toggle(a: Amenity) {
    setAmenities((list) => (list.includes(a) ? list.filter((x) => x !== a) : [...list, a]));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStep(null);
    start(async () => {
      const result = await publishListing({
        title,
        description,
        offering,
        city,
        area,
        bedrooms: bedroomsApply ? bedrooms : 1,
        maxGuests,
        amenities,
        houseRules,
        hostPresent,
        acceptsPoints,
        acceptsDirectSwap: acceptsSwap,
        addressLine,
        pincode,
        location,
        availability: openFrom && openUntil ? [{ start: openFrom, end: openUntil }] : [],
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }

      // Photos go up after the listing exists: the bucket policy keys on the
      // listing id, so there is nowhere to put them before this point.
      if (photos.length > 0) {
        try {
          const uploaded = [];
          for (const [index, photo] of photos.entries()) {
            setStep(`Uploading photo ${index + 1} of ${photos.length}…`);
            uploaded.push(await uploadListingPhoto(result.id, photo.file));
          }
          await saveListingPhotos(result.id, uploaded);
        } catch (uploadError) {
          // The listing is live either way. Say what happened rather than
          // losing the listing over a photo.
          const message =
            uploadError instanceof Error ? uploadError.message : String(uploadError);
          setStep(null);
          setError(
            `Your listing is published, but a photo did not upload: ${message}. Add photos again from My home.`
          );
          return;
        }
      }

      router.push("/host");
    });
  }

  return (
    <form onSubmit={submit} className="space-y-10">
      <fieldset>
        <legend className="mb-3.5 text-lg font-semibold">What are you offering?</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          {options.map(({ v, icon: Icon, t, d }) => (
            <label key={v} className="cursor-pointer">
              <input
                type="radio"
                name="offering"
                value={v}
                checked={offering === v}
                onChange={() => setOffering(v)}
                className="peer sr-only"
              />
              <span className="block h-full rounded-lg border bg-surface p-4 transition-colors peer-checked:border-brand peer-checked:bg-brand-tint peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-brand">
                <Icon className="size-5 text-brand" aria-hidden />
                <span className="mt-3 block font-semibold">{t}</span>
                <span className="mt-0.5 block text-sm text-muted">{d}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">About the place</h2>
        <div className="space-y-1.5">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Sunlit 2BHK near the park"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="city">City</Label>
            <Select id="city" value={city} onChange={(e) => setCity(e.target.value)}>
              {cities.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="area">Area</Label>
            <Input
              id="area"
              required
              value={area}
              onChange={(e) => setArea(e.target.value)}
              placeholder="Greater Kailash II"
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {bedroomsApply && (
            <div className="space-y-1.5">
              <Label htmlFor="beds">Bedrooms</Label>
              <Input
                id="beds"
                type="number"
                min={1}
                max={20}
                value={bedrooms}
                onChange={(e) => setBedrooms(Math.max(1, Number(e.target.value) || 1))}
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="guests">Max guests</Label>
            <Input
              id="guests"
              type="number"
              min={1}
              max={30}
              value={maxGuests}
              onChange={(e) => setMaxGuests(Math.max(1, Number(e.target.value) || 1))}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="about">Describe it</Label>
          <Textarea
            id="about"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What makes it comfortable to stay in?"
          />
        </div>
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border bg-surface p-4">
          <input
            type="checkbox"
            checked={hostPresent}
            onChange={(e) => setHostPresent(e.target.checked)}
            className="mt-0.5 size-4 accent-[var(--color-brand)]"
          />
          <span>
            <span className="block font-semibold">You&apos;ll be home during the stay</span>
            <span className="mt-0.5 block text-sm text-muted">
              Guests see this on the card, so nobody arrives expecting the place to themselves.
            </span>
          </span>
        </label>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Where it is</h2>
          <p className="mt-1 text-sm text-muted">
            The street address is held back until you approve a stay. Guests see only the area until
            then.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
          <div className="space-y-1.5">
            <Label htmlFor="address">Street address</Label>
            <Input
              id="address"
              value={addressLine}
              onChange={(e) => setAddressLine(e.target.value)}
              placeholder="Flat and building, street"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pincode">Pincode</Label>
            <Input id="pincode" value={pincode} onChange={(e) => setPincode(e.target.value)} />
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Roughly where it is</p>
          <p className="text-sm text-muted">
            Optional, and never exact. Guests browsing see a circle about half a
            kilometre across, so they can judge the area without being able to find
            the building.
          </p>
          <LocationPicker city={city} value={location} onChange={setLocation} />
        </div>
      </section>

      <fieldset>
        <legend className="mb-1.5 text-lg font-semibold">What&apos;s included</legend>
        <p className="mb-3.5 text-sm text-muted">
          Some of these raise what your home earns per night.
        </p>
        <div className="flex flex-wrap gap-2">
          {AMENITIES.map((a) => (
            <label key={a} className="cursor-pointer">
              <input
                type="checkbox"
                checked={amenities.includes(a)}
                onChange={() => toggle(a)}
                className="peer sr-only"
              />
              <span className="inline-block rounded-md border border-field px-3.5 py-2 text-sm font-medium peer-checked:border-brand peer-checked:bg-brand-tint peer-checked:text-brand peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-brand">
                {a}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-1.5 text-lg font-semibold">How guests can book it</legend>
        <p className="mb-3.5 text-sm text-muted">Pick at least one. You can offer both.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="cursor-pointer">
            <input
              type="checkbox"
              checked={acceptsPoints}
              onChange={(e) => setAcceptsPoints(e.target.checked)}
              className="peer sr-only"
            />
            <span className="block h-full rounded-lg border bg-surface p-4 transition-colors peer-checked:border-brand peer-checked:bg-brand-tint peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-brand">
              <KeyRound className="size-5 text-brand" aria-hidden />
              <span className="mt-3 block font-semibold">Points</span>
              <span className="mt-0.5 block text-sm text-muted">
                Anyone with enough points can request it, and you earn points by hosting.
              </span>
            </span>
          </label>
          <label className="cursor-pointer">
            <input
              type="checkbox"
              checked={acceptsSwap}
              onChange={(e) => setAcceptsSwap(e.target.checked)}
              className="peer sr-only"
            />
            <span className="block h-full rounded-lg border bg-surface p-4 transition-colors peer-checked:border-brand peer-checked:bg-brand-tint peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-brand">
              <ArrowLeftRight className="size-5 text-brand" aria-hidden />
              <span className="mt-3 block font-semibold">Direct swap</span>
              <span className="mt-0.5 block text-sm text-muted">
                Trade stays with another member. Any difference in value is settled in points.
              </span>
            </span>
          </label>
        </div>
        {noMode && (
          <p role="alert" className="mt-3 text-sm text-alert">
            Choose points, direct swap, or both. A listing has to be bookable some way.
          </p>
        )}
      </fieldset>

      <section className="space-y-2.5">
        <h2 className="text-lg font-semibold">When it&apos;s free</h2>
        <p className="text-sm text-muted">
          Guests can only request dates you have opened. You can add more windows later.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="open-from">From</Label>
            <Input
              id="open-from"
              type="date"
              value={openFrom}
              onChange={(e) => setOpenFrom(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="open-until">Until</Label>
            <Input
              id="open-until"
              type="date"
              value={openUntil}
              onChange={(e) => setOpenUntil(e.target.value)}
            />
          </div>
        </div>
      </section>

      <section className="space-y-2.5">
        <h2 className="text-lg font-semibold">House rules</h2>
        <Textarea
          value={houseRules}
          onChange={(e) => setHouseRules(e.target.value)}
          placeholder="One rule per line. Guests accept these before a stay is confirmed."
        />
      </section>

      <section>
        <h2 className="text-lg font-semibold">Photos</h2>
        <p className="mb-3.5 mt-1 text-sm text-muted">
          A home is sold by its rooms. Without photos your listing falls back to a
          stock picture, which no guest trusts.
        </p>
        <PhotoPicker photos={photos} onChange={setPhotos} disabled={pending} />
      </section>

      <div className="rounded-lg border border-brand/25 bg-brand-tint p-5">
        <p className="text-sm font-medium text-muted">Your home would earn</p>
        <p className="mt-1 text-3xl font-extrabold tracking-tight text-brand">
          {rate} points <span className="text-base font-semibold">a night</span>
        </p>
        <p className="mt-2 text-sm text-muted">
          Guests pay the same rate to stay. The figure is fixed when you publish, so a later change
          to the rules never reprices a stay already booked.
        </p>
        {acceptsSwap && (
          <p className="mt-1.5 text-sm text-muted">
            On a direct swap, this is the value your side of the trade is worth.
          </p>
        )}
        <p className="mt-1.5 text-sm text-muted">
          Suggested deposit from phase 2: ₹{DEPOSIT_INR[offering].toLocaleString("en-IN")}, which you
          can waive.
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-md bg-alert/10 px-3.5 py-2.5 text-sm text-alert">
          {error}
        </p>
      )}

      {step && <p className="text-sm text-muted">{step}</p>}

      <div className="flex gap-3">
        <Button type="submit" size="lg" disabled={noMode || pending}>
          {pending ? (step ?? "Publishing…") : "Publish listing"}
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/host">Cancel</Link>
        </Button>
      </div>
    </form>
  );
}
