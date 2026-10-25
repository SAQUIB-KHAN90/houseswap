import { LOCAL_HOME_PHOTOS } from "@/lib/local-photos";

/**
 * Stock photography: the fallback for a listing whose host has not uploaded
 * photos yet.
 *
 * Real photos live in Supabase Storage and are read through
 * `src/lib/db/photos.ts`. These are what a listing shows until then, and what
 * the landing page uses for its own illustrations.
 *
 * Each entry is an Unsplash photo id. To change a photo, open the photo on
 * unsplash.com, copy the id out of its image URL
 * (images.unsplash.com/photo-<THIS PART>) and paste it here.
 *
 * Replace these with your own hosted photos before launch: these are
 * placeholders, and a listing's photos should be the host's own.
 */

const src = (id: string, w: number, h: number) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&h=${h}&q=70`;

// Declared after the helper it uses; see the local() definition below.
export const heroPhoto = LOCAL_HOME_PHOTOS[0] ?? src("1600585154340-be6161a56a0c", 2000, 1100);

const listingPhotoIds: Record<string, string[]> = {
  "dl-greater-kailash-2bhk": [
    "1600121848594-d8644e57abab",
    "1600585154340-be6161a56a0c",
    "1600566753086-00f18fb6b3ea",
    "1600489000022-c2086d79f9d4",
    "1556228453-efd6c1ff04f6",
  ],
  "dl-saket-room-kitchen": [
    "1586105251261-72a756497a11",
    "1522708323590-d24dbb6b0267",
    "1484154218962-a197022b5858",
    "1600210492486-724fe5c67fb0",
    "1507089947368-19c1da9775ae",
  ],
  "ch-sector-17-1bhk": [
    "1493809842364-78817add7ffb",
    "1600607687939-ce8a6c25118c",
    "1600566753190-17f0baa2a6c3",
    "1524758631624-e2822e304c36",
    "1560448204-e02f11c3d0e2",
  ],
  "ch-sector-35-room": [
    "1600210492486-724fe5c67fb0",
    "1505693416388-ac5ce068fe85",
    "1631049307264-da0ec9d70304",
    "1556228578-8c89e6adf883",
    "1502672260266-1c1ef2d93688",
  ],
  "jp-c-scheme-3bhk": [
    "1600596542815-ffad4c1539a9",
    "1600607687644-c7171b42498b",
    "1600585153490-76fb20a32601",
    "1571624436279-b272aff752b5",
    "1600573472592-401b489a3cdc",
  ],
  "jp-malviya-nagar-room-kitchen": [
    "1505691938895-1758d7feb511",
    "1631679706909-1844bbd07221",
    "1600607688969-a5bfcd646154",
    "1555041469-a586c61ea9bc",
    "1552321554-5fefe8c9ef14",
  ],
};

const photoSets = Object.values(listingPhotoIds);

/**
 * Picks a photo set for an id that has none of its own, which is every listing
 * created in the app: its id is a UUID, not one of the keys above. Hashing the
 * id keeps the choice stable, so a listing does not change pictures between
 * renders, and spreads listings across the sets instead of giving them all the
 * same cover. Goes away once hosts upload their own photos.
 */
function setFor(id: string): string[] {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return photoSets[hash % photoSets.length];
}

/**
 * Five photos for a listing: one wide, four small.
 *
 * Anything in `public/homes` wins. The stock photography is served from
 * images.unsplash.com, which a fair number of networks block outright — and a
 * listing with no picture looks broken to the person looking at it, whoever's
 * fault that is. Local files have no such problem.
 *
 * Run `npm run photos:index` after adding files there.
 */
export function listingPhotos(id: string) {
  if (LOCAL_HOME_PHOTOS.length > 0) {
    const picked = pickLocal(id, 5);
    return { cover: picked[0], coverWide: picked[0], gallery: picked.slice(1) };
  }

  const ids = listingPhotoIds[id] ?? setFor(id);
  return {
    cover: src(ids[0], 800, 600),
    coverWide: src(ids[0], 1200, 800),
    gallery: ids.slice(1).map((p) => src(p, 600, 600)),
  };
}

/**
 * A stable run of local photos for one listing.
 *
 * Starts at a position derived from the id, so two listings rarely open with
 * the same cover, and wraps so a short folder still fills the mosaic.
 */
function pickLocal(id: string, count: number): string[] {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;

  const start = hash % LOCAL_HOME_PHOTOS.length;
  return Array.from(
    { length: count },
    (_, i) => LOCAL_HOME_PHOTOS[(start + i) % LOCAL_HOME_PHOTOS.length]
  );
}

/**
 * A listing's photos: the host's own where they exist, stock where they do not.
 *
 * Mixing the two is deliberate. A host with three real photos should show
 * those three, not three real ones and nothing in the mosaic's other slots.
 */
export function photosFor(id: string, uploaded: string[]) {
  const stock = listingPhotos(id);
  if (uploaded.length === 0) return stock;

  const [first, ...rest] = uploaded;
  return {
    cover: first,
    coverWide: first,
    // Keep the mosaic full: real photos first, stock behind them.
    gallery: [...rest, ...stock.gallery].slice(0, 4),
  };
}

/**
 * The page's own illustrations, which have the same problem as the listing
 * photos: served from a CDN that some networks block. A local file wins here
 * too, picked by position so the same slot always shows the same picture.
 */
const local = (index: number, fallback: string) =>
  LOCAL_HOME_PHOTOS.length > 0
    ? LOCAL_HOME_PHOTOS[index % LOCAL_HOME_PHOTOS.length]
    : fallback;

/** Photo used for a room in the check-in / check-out record. */
export const roomPhotos: Record<string, string> = {
  living: local(0, src("1600121848594-d8644e57abab", 600, 450)),
  kitchen: local(1, src("1600489000022-c2086d79f9d4", 600, 450)),
  bedroom: local(2, src("1600566753086-00f18fb6b3ea", 600, 450)),
  bath: local(3, src("1556228453-efd6c1ff04f6", 600, 450)),
};

export const stepPhotos = [
  local(4, src("1522071820081-009f0129c71c", 800, 600)),
  local(5, src("1512917774080-9991f1c4c750", 800, 600)),
  local(6, src("1484154218962-a197022b5858", 800, 600)),
];

export const trustPhoto = local(7, src("1600607687920-4e2a09cf159d", 1000, 1200));
