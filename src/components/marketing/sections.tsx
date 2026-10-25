import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Camera,
  Check,
  DoorOpen,
  Home,
  Minus,
  ShieldCheck,
  Utensils,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Photo } from "@/components/ui/photo";
import { ListingCard } from "@/components/listings/listing-card";
import type { ListingView } from "@/lib/db/listings";
import { stepPhotos, trustPhoto } from "@/lib/images";

export function FeaturedStays({
  listings,
  covers,
}: {
  listings: ListingView[];
  covers: Map<string, string>;
}) {
  // Nothing to show before the first host publishes, which is the normal state
  // of a new pilot city rather than an error.
  if (listings.length === 0) return null;

  return (
    <section className="container-x py-14">
      <div className="mb-6 flex items-end justify-between gap-6">
        <div>
          <h2 className="text-2xl font-bold sm:text-[28px]">Homes in the pilot</h2>
          <p className="mt-1 text-muted">Every host here is ID verified.</p>
        </div>
        <Link
          href="/search"
          className="hidden shrink-0 items-center gap-1.5 text-sm font-semibold text-brand hover:underline sm:inline-flex"
        >
          See all stays
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
      {/* Two rows of four. One row reads as a sample; two reads as a place
          with homes in it, which is the impression that matters on a landing
          page for a network nobody has heard of. */}
      <div className="grid gap-x-6 gap-y-9 sm:grid-cols-2 lg:grid-cols-4">
        {listings.slice(0, 8).map((l) => (
          <ListingCard key={l.id} listing={l} coverUrl={covers.get(l.id)} />
        ))}
      </div>
    </section>
  );
}

export function HowItWorks() {
  const steps: { title: string; body: string; photo: string }[] = [
    {
      title: "List what you're comfortable with",
      body: "Your whole home while you're away, or just a room while you're there. You set the dates and the house rules.",
      photo: stepPhotos[0],
    },
    {
      title: "Host a stay, earn points",
      body: "Points scale with what you offer. Bigger homes and more amenities earn more per night.",
      photo: stepPhotos[1],
    },
    {
      title: "Spend them anywhere",
      body: "No need to find someone who wants your city on your dates. Book any home in the network.",
      photo: stepPhotos[2],
    },
  ];

  return (
    <section id="how" className="scroll-mt-20 border-y bg-surface py-14">
      <div className="container-x">
        <h2 className="max-w-2xl text-2xl font-bold sm:text-[32px]">
          You don't swap with one person. You swap with the network.
        </h2>
        <div className="mt-10 grid gap-8 md:grid-cols-3">
          {steps.map((s) => (
            <div key={s.title}>
              <div className="aspect-[16/11] overflow-hidden rounded-lg">
                <Photo src={s.photo} alt="" sizes="(max-width: 768px) 100vw, 33vw" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
              <p className="mt-1.5 leading-relaxed text-muted">{s.body}</p>
            </div>
          ))}
        </div>
        <Button asChild className="mt-10">
          <Link href="/signup">Join the pilot</Link>
        </Button>
      </div>
    </section>
  );
}

export function WaysToOffer() {
  const ways: { icon: typeof Home; title: string; body: string; points: string }[] = [
    {
      icon: Home,
      title: "Entire home",
      body: "You're away and guests have the whole place, kitchen included.",
      points: "Earns the most",
    },
    {
      icon: Utensils,
      title: "Room + kitchen",
      body: "A private room plus kitchen access. You may be home.",
      points: "Earns mid-range",
    },
    {
      icon: DoorOpen,
      title: "Private room",
      body: "A private room with shared living spaces. Good for solo guests.",
      points: "Earns least",
    },
  ];

  return (
    <section id="homes" className="container-x scroll-mt-20 py-14">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <h2 className="max-w-xl text-2xl font-bold sm:text-[32px]">
          Offer the whole house, or just a room
        </h2>
        <p className="max-w-sm text-muted">
          Three ways to host. You approve every request before anyone arrives.
        </p>
      </div>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {ways.map(({ icon: Icon, title, body, points }) => (
          <div key={title} className="rounded-lg border bg-surface p-6 shadow-card">
            <span className="grid size-11 place-items-center rounded-md bg-brand-tint">
              <Icon className="size-5 text-brand" aria-hidden />
            </span>
            <h3 className="mt-5 text-lg font-semibold">{title}</h3>
            <p className="mt-1.5 leading-relaxed text-muted">{body}</p>
            <p className="mt-5 text-sm font-semibold text-brand">{points}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function TrustSection() {
  const facts: { icon: typeof BadgeCheck; title: string; body: string }[] = [
    {
      icon: BadgeCheck,
      title: "ID and selfie, before anything else",
      body: "Nobody can list a home or send a request without passing verification. Aadhaar numbers are never stored on our side.",
    },
    {
      icon: Camera,
      title: "Every room photographed twice",
      body: "A guided checklist at check-in sets the baseline. The same checklist at check-out shows what changed.",
    },
    {
      icon: ShieldCheck,
      title: "Points held until check-out is clear",
      body: "The guest's points sit in escrow. They reach the host 24 hours after check-out if nothing is reported.",
    },
  ];

  return (
    <section id="trust" className="scroll-mt-20 border-y bg-surface py-14">
      <div className="container-x grid items-center gap-10 lg:grid-cols-2">
        <div className="aspect-[4/3] overflow-hidden rounded-lg lg:aspect-[5/6]">
          <Photo src={trustPhoto} alt="" sizes="(max-width: 1024px) 100vw, 50vw" />
        </div>
        <div>
          <Badge variant="brand">Trust and safety</Badge>
          <h2 className="mt-4 text-2xl font-bold sm:text-[32px]">
            Letting a stranger into your home needs more than a review score.
          </h2>
          <ul className="mt-8 space-y-7">
            {facts.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-4">
                <Icon className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden />
                <div>
                  <h3 className="font-semibold">{title}</h3>
                  <p className="mt-1 leading-relaxed text-muted">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

export function Comparison() {
  const cols = ["HouseSwap", "Hotel", "Rental app", "Direct swap"];
  const rows: [string, (boolean | string)[]][] = [
    ["No cash per night", [true, false, false, true]],
    ["Kitchen and living space", [true, "Limited", true, true]],
    ["Works without matching dates", [true, true, true, false]],
    ["Identity verified both ways", [true, "Varies", "Varies", false]],
    ["Condition photo record", [true, false, false, false]],
  ];

  return (
    <section className="container-x py-14">
      <h2 className="text-2xl font-bold sm:text-[32px]">How it compares</h2>
      <div className="mt-7 overflow-x-auto rounded-lg border bg-surface">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="p-4 font-medium">
                <span className="sr-only">Feature</span>
              </th>
              {cols.map((c, i) => (
                <th
                  key={c}
                  className={`p-4 text-base font-semibold ${i === 0 ? "bg-brand-tint text-brand" : ""}`}
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, vals]) => (
              <tr key={label} className="border-b last:border-0">
                <th scope="row" className="p-4 font-medium">
                  {label}
                </th>
                {vals.map((v, i) => (
                  <td key={i} className={`p-4 ${i === 0 ? "bg-brand-tint/40" : ""}`}>
                    {v === true ? (
                      <>
                        <Check className="size-5 text-brand" aria-hidden />
                        <span className="sr-only">Yes</span>
                      </>
                    ) : v === false ? (
                      <>
                        <Minus className="size-5 text-muted/40" aria-hidden />
                        <span className="sr-only">No</span>
                      </>
                    ) : (
                      <span className="text-muted">{v}</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function Reviews() {
  const items = [
    {
      quote:
        "I hosted twice in Mayur Vihar and used the points for a week in Jaipur. Cost me nothing but a deep clean.",
      name: "Nikhil R.",
      city: "Delhi",
    },
    {
      quote:
        "The check-in photos took ten minutes and settled a question about a scratch that was already there.",
      name: "Simran G.",
      city: "Chandigarh",
    },
    {
      quote:
        "I only offer the spare room with kitchen access. Guests know I'm home and the rules are on the listing.",
      name: "Ananya S.",
      city: "Jaipur",
    },
  ];

  return (
    <section className="border-y bg-surface py-14">
      <div className="container-x">
        <h2 className="text-2xl font-bold sm:text-[32px]">From the first members</h2>
        <ul className="mt-8 grid gap-4 md:grid-cols-3">
          {items.map((r) => (
            <li key={r.name} className="rounded-lg border bg-page p-6">
              <p className="leading-relaxed">{r.quote}</p>
              <p className="mt-5 text-sm font-semibold">
                {r.name}
                <span className="font-normal text-muted"> · {r.city}</span>
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function Faq() {
  const qs: [string, string][] = [
    [
      "Do I have to be away for someone to stay?",
      "For an entire-home listing, yes. For a room or room + kitchen you can be at home. You choose the type and the dates.",
    ],
    [
      "How do I get points to start?",
      "Verified members get starter points, enough for a first short trip. After that you earn them by hosting.",
    ],
    [
      "What if something gets damaged?",
      "Report it within 24 hours of check-out. We compare the two photo sets and decide how many of the held points move to the host.",
    ],
    [
      "Is my Aadhaar number stored?",
      "No. A licensed verification provider confirms who you are and we keep only a verified flag and a reference.",
    ],
    [
      "What happens if someone cancels?",
      "Cancelling early returns the points in full. Cancelling close to the date costs points. Hosts who cancel after approving lose standing.",
    ],
  ];

  return (
    <section id="faq" className="container-x scroll-mt-20 py-14">
      <div className="grid gap-8 lg:grid-cols-[0.7fr_1.3fr]">
        <h2 className="text-2xl font-bold sm:text-[32px]">Questions people ask first</h2>
        <div className="divide-y border-y">
          {qs.map(([q, a]) => (
            <details key={q} className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 font-semibold">
                {q}
                <span
                  aria-hidden
                  className="grid size-7 shrink-0 place-items-center rounded-full bg-ink/[0.06] transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="mt-2.5 max-w-2xl leading-relaxed text-muted">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section className="border-t bg-brand-tint py-14">
      <div className="container-x flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold sm:text-[32px]">Host once. Stay anywhere.</h2>
          <p className="mt-1.5 text-muted">
            The pilot is open to verified members in Delhi, Chandigarh and Jaipur.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/signup">Join the pilot</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/search">Browse stays</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
