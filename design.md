# HouseSwap — Design Guidelines

Status: Draft v0.2 · Date: 2026-10-24
Direction: a photo-forward booking product, in the idiom of Kindred, Booking.com, Airbnb and
HomeExchange. We take the *structural* pattern of those products — photography does the selling,
a persistent search control, calm grids of property cards, trust markers sitting next to the thing
they describe. The palette, typography, logo and copy are our own.

## 1. Principles
1. **Photos lead.** A home is sold by its rooms, not by a headline. Every listing, step and trust
   claim is anchored to an image.
2. **Chrome stays quiet.** White surfaces, hairline borders, soft shadows. One accent colour, used
   only for actions and verified states.
3. **Trust sits next to the subject.** The verified badge is on the host, the rating is on the card,
   the photo record is on the stay. No separate "trust us" theatre.
4. **Small type, dense information.** Body 15px, card titles 16px, section headings 28–32px. People
   are comparing options, not reading an essay.
5. **Mobile first.** Most browsing and every check-in photo happens on a phone.

## 2. Colour tokens
Defined on `:root` in `src/app/globals.css` and exposed to Tailwind via `@theme inline`.

| Token | Hex | Use |
|---|---|---|
| `page` | #FBFAF8 | Page background (warm near-white) |
| `surface` | #FFFFFF | Cards, header, panels |
| `ink` | #1B1A17 | Primary text, avatars, dark buttons |
| `muted` | #6B665E | Secondary text |
| `line` | #E7E3DC | Borders, dividers |
| `field` | #D6D1C8 | Input borders |
| `brand` | #13624E | Primary actions, verified states, links |
| `brand-hover` | #0E4F3E | Primary hover |
| `brand-tint` | #E8F1ED | Selected states, soft bands, badges |
| `star` | #E0952B | Ratings, "needs attention" badges |
| `alert` | #B8412E | Errors, disputes |

Deep jade reads as travel and trust without borrowing any reference brand's colour. Amber is
reserved for ratings so a star always means the same thing.

## 3. Typography
One family: **Plus Jakarta Sans** (via `next/font/google`), weights 400 / 500 / 600 / 800.

| Role | Size | Weight |
|---|---|---|
| Hero h1 | 34 → 56px | 800 |
| Section h2 | 24 → 32px | 700 |
| Card title / h3 | 16–18px | 600 |
| Body | 15px | 400 |
| Meta, captions | 13–14px | 400–500 |

Headings carry `letter-spacing: -0.02em` and `text-wrap: balance`. No all-caps labels, no accenting
a single word inside a headline.

## 4. Shape, depth, spacing
- Radii: `sm` 8px (inputs, chips), `md` 12px (buttons, small photos), `lg` 18px (cards, photos),
  `xl` 26px (hero, search bar).
- Shadows: `card` for resting cards, `lift` on hover, `bar` for the floating search bar.
- 8px spacing base. Section padding 56px (`py-14`). Content max-width 1280px.

## 5. Key components
- **Listing card** — 20:17 photo, rounded `lg`, save (heart) top-right, "Host is home" chip
  top-left when the host stays. Below: "Area, City" + rating on one line, offering type and
  capacity, then `N points night`. The whole card is one link; the photo scales slightly on hover.
- **Photo** (`components/ui/photo.tsx`) — every image goes through this. Shows a neutral
  placeholder while loading and keeps it if the image fails, so a dead URL never looks broken.
- **Hero search** — white bar overlapping the hero photo: Where to / Check in / Check out /
  Stay type / Search. Repeated as a compact pill in the header on inner pages.
- **Photo mosaic** — listing detail: one wide photo plus a 2×2 grid, collapsing to the single
  cover photo on mobile.
- **Rating** — amber star, one decimal, optional stay count.
- **Badge** — `brand` (verified, live), `star` (attention), `glass` (over photos), `alert`
  (disputes), `outline`, `solid`.
- **Evidence pair** — check-in and check-out photos side by side with a verdict badge. Used in both
  the guest check-out flow and the staff dispute queue.

## 6. Page structure
**Landing:** header with compact search → hero photo with headline and floating search bar →
city/type chip rail → 4-up stay grid → how it works (3 photo columns) → ways to offer (3 cards) →
trust (photo + three facts) → comparison table → member quotes → FAQ → CTA band → footer.

**App:** sticky header with logo, section nav, points chip and avatar. Pages are
`container-x py-9` with a `PageTitle` block.

**Screens:** sign up · verify (3 steps) · plan a trip · search results · listing detail ·
new listing · requests · check-in / check-out checklist · messages · points · my home · profile ·
staff disputes.

## 7. Imagery
- Stock photography during the pilot, all URLs in `src/lib/images.ts` so a photo can be swapped by
  changing one id. Replace with hosts' own photos before launch.
- Warm, lived-in interiors. Consistent crops: 20:17 cards, 16:11 steps, 4:3 evidence.
- Alt text describes the home and city; decorative images take `alt=""`.

## 8. Motion
One orchestrated moment only: the hero photo fades in as it loads. Otherwise motion answers an
action — hover lift on cards, the photo scale on card hover, the FAQ disclosure. No scroll-triggered
section entrances. `prefers-reduced-motion` is respected globally.

## 9. Voice
Plain, active, specific. Buttons say what happens ("Request stay", "Confirm check-in"). Numbers are
stated as points, never as rupees. Trust copy says what the system does, not that it is safe:
"Every room photographed twice", not "Your safety is our priority".

## 10. Accessibility
- WCAG AA contrast; brand green on white passes for text and icons.
- Visible focus ring (2px brand, 2px offset) on every interactive element.
- Ratings, progress bars and icon-only cells carry screen-reader text.
- Tap targets ≥ 36px, primary actions 44px+.
- Breakpoints 360 / 640 / 768 / 1024 / 1280. No horizontal page scroll at 360px.
