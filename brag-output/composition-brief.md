# Hyperframes Composition Brief: HouseSwap

## Objective
Create a short launch-style brag video for HouseSwap — a points-based home-swap
network for India.

## Output
- Composition directory: `brag-output/composition/`
- Rendered video: `brag-output/brag.mp4`
- Format: landscape — 1920x1080
- Duration: 20s

## Source Material
- Project root: `C:/Users/ASUS Vivobook/Desktop/Saquib/houseswap`
- Primary files read: `src/app/page.tsx`, `src/components/marketing/sections.tsx`,
  `src/app/globals.css`, `src/components/listings/listing-card.tsx`,
  `src/lib/points/rates.ts`, `prd.md`, `README.md`
- Product name: HouseSwap
- Tagline / strongest claim: **"Your home is your ticket."**
- Key UI to recreate: the **listing card** — a real room photo, area and city,
  rating, offering type, and `N points night`. Photos are the project's own
  stock set from `src/lib/images.ts`, downloaded into `assets/photos/` so the
  render never depends on reaching a CDN. Then the **request panel** resolving a points
  total into a held amount, and the **evidence pair** (check-in beside
  check-out).
- Copy that must appear verbatim:
  - "You don't swap with one person. You swap with the network."
  - "Every room photographed twice."
  - "Your home is your ticket."
  - "Pilot · Delhi, Chandigarh and Jaipur"
  - Rates straight from the formula in `src/lib/points/rates.ts`:
    56, 40 and 14 points a night.

## Creative Direction
- Tone preset: `polished`
- Creative direction: a quiet, confident product film for something that
  actually works
- Interpretation: four scenes, long holds, soft crossfades. Restraint is the
  argument — a product that handles someone's home and someone's points should
  not sound like a mobile game ad.
- Angle: every home-swap product dies on the same problem — a swap needs two
  people who each want the other's city on the same dates, which almost never
  happens. HouseSwap replaces the handshake with points. The video states the
  problem, breaks it, then shows the working app.
- Hook: two home cards facing each other across a double-headed arrow; the
  arrow snaps and both grey out. Line: "Nobody wants your city on your dates."
- Outro / punchline: "Your home is your ticket." over the mark, pilot cities
  beneath.
- Avoid:
  - Generic SaaS language
  - Abstract filler visuals
  - Unrelated visual redesign

## Visual Identity
- Background: `#FBFAF8` (`--page`), surface `#FFFFFF`
- Text: `#1B1A17` (`--ink`), secondary `#6B665E` (`--muted`)
- Accent: `#13624E` (`--brand`), tint `#E8F1ED` (`--brand-tint`)
- Highlight: `#E0952B` (`--star`) — ratings only
- Display font: **Outfit** (bundled). The product uses Plus Jakarta Sans, which
  is not in the Hyperframes bundle; Outfit is the nearest geometric humanist
  face and avoids a `font_family_without_font_face` lint failure. Documented
  substitution, not a redesign.
- Body font: Outfit
- Visual references: listing card (20:17 photo block, rating, `N points
  night`), category chips, the jade/warm-white palette, 18px card radius.

## Storyboard
Use the storyboard in `brag-output/brag-plan.md` as the creative contract.

Scene summary:
1. The problem — 3.5s — two homes, an arrow that snaps; "Nobody wants your city on your dates."
2. The network — 4.5s — one home, three cities, points flowing out; "You don't swap with one person. You swap with the network."
3. The app working — 8.5s — three real listing cards arrive one by one; 56 × 4 resolves to 224 points **held**; check-in and check-out frames meet under "Every room photographed twice."
4. Outro — 3.5s — mark, "Your home is your ticket.", pilot cities.

## Audio
- Audio role: warm bed with sparse, motion-matched accents
- Audio arc: low bed from 0s, a small lift at the network reveal, steady under
  the working-app section, fade out across the last 1.5s
- Music: `assets/music/happy-beats-business-moves-vol-12-by-ende-dot-app.mp3`
  (110 BPM, calmest of the five bundled tracks — suits `polished`)
- Music treatment: `data-volume` 0.30, `data-fade-out` 1.5
- Music cue guidance: bundled preset, copied to
  `assets/music/cues/happy-beats-business-moves-vol-12-by-ende-dot-app.music-cues.json`.
  Tempo 109.96. Strong cues to target: **8.74s** (first listing card),
  **13.11s** (points resolve to held), **17.47s** (outro settles).
  Sequential listing cards snap to every other beat — 8.74 / 9.83 / 10.93 — so
  each card holds ~1.1s rather than 0.55s, which keeps the rates readable.
- Audio-reactive treatment: **not implemented — extraction unavailable.** The
  `media-use` helper (`audio/scripts/extract-audio-data.py`) is installed, but
  neither Python nor `uv` is on this machine, so per-frame RMS/band data could
  not be extracted. Per the skill's own guidance this is noted rather than
  allowed to block the render. The film carries its musicality through the
  beat-locked and beat-grid timings below instead. To add it later: install
  `uv`, run the helper against the track, and wire the data to the jade field
  behind the network — glow and presence only, no waveform or equalizer.
- Audio-coupled moments:
  - Scene 1, arrow snaps — one dry wood tick, no whoosh
  - Scene 2, three city homes land — soft drop per arrival
  - Scene 3, three listing cards — card-place per card, on the beat grid
  - Scene 3, counter resolves to 224 — soft bell on the 13.11s cue
  - Scene 3, photo frames meet — one quiet drop
- SFX selection guidance: polished means 2–3 families, not a grab bag. Copied
  and available: `interface/drop_001`, `interface/drop_002`,
  `interface/bong_001`, `casino/card-place-1..3`,
  `impact/impactWood_light_001`.
- SFX analysis guidance: `<brag-skill-dir>/assets/sfx/sfx-analysis.md` —
  prefer low high-frequency-risk files for the repeated card sounds.
- Exact SFX choice: timestamps set against the implemented animation.
- Audio files: copied into `assets/music/` and `assets/sfx/` already.
- Volumes: music 0.30; SFX 0.45–0.60 (polished restraint).

## Hyperframes Instructions
Single-file composition in `index.html` with four timed scene sections on one
root timeline — not nested composition files. The piece is four scenes on one
stage with no reuse, and the single-file shape avoids the host-id/scene-id
mismatch that costs 45s a scene at render.

Requirements:
- Show real UI from the project: the listing card, the points total, the
  evidence pair.
- Every number and line on screen is grounded in the project's own files.
- Keep all text readable: short label ≥0.8s settled, sentence ≥0.3s/word.
- 20s total.
- `fromTo` everywhere — never `from` — so every frame is seek-safe.
- Run `npx hyperframes check` before render; it is the single gate.
- Keep creation and rendering local.

## Grounding
No invented claims. Rates come from `pointsPerNight()`; the trust line, the
network line and the hero line are verbatim site copy; the cities are the real
pilot cities. Nothing personal appears — the developer contact details in the
site footer, the Supabase URL and all keys are excluded.

## Credit
Music: Sascha Ende, ende.app (CC BY 4.0).
