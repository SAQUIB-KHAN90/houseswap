/**
 * Map settings, in one place.
 *
 * Tiles come from OpenStreetMap, which needs no key and no account. The stack
 * in architecture.md 2 names Mapbox or Google; both want a key, a billing
 * account and a vendor decision, and none of that is worth making before the
 * pilot has shown anyone wants a map. Swapping later is this file: a tile URL,
 * an attribution string, and whatever key the provider wants.
 *
 * OpenStreetMap's tile policy expects light, attributed use. A pilot in three
 * cities is light; if the map stays, move to a provider with a paid tier.
 */
export const TILES = {
  url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  maxZoom: 18,
} as const;

/** Where to open the map when a listing has no point yet. */
export const CITY_CENTRES: Record<string, [number, number]> = {
  Delhi: [28.6139, 77.209],
  Chandigarh: [30.7333, 76.7794],
  Jaipur: [26.9124, 75.7873],
};

export const DEFAULT_CENTRE: [number, number] = CITY_CENTRES.Delhi;

export function centreFor(city: string | undefined): [number, number] {
  return (city && CITY_CENTRES[city]) || DEFAULT_CENTRE;
}

/**
 * The radius, in metres, of the circle drawn instead of a pin.
 *
 * The stored point is already rounded to about 100 m. The circle is wider
 * again so the shape does not imply a precision the number does not have, and
 * so nobody can pick out a building from a listing they have not been approved
 * for. The exact address is a different column with a different policy.
 */
export const APPROX_RADIUS_M = 500;
