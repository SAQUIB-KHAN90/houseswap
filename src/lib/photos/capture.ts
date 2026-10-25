/**
 * Preparing a photo in the browser, before it is uploaded.
 *
 * Everything here runs on the member's device, which is deliberate:
 *
 * - **Resizing** happens before the upload, not after. A phone photo is 4–8 MB
 *   and most of this product is used on Indian mobile data, so sending the
 *   original and resizing server-side would make check-in unusable on a weak
 *   connection (architecture.md 9). A resized JPEG is well under 500 KB.
 *
 * - **Hashing** happens on the exact bytes that get uploaded, so the hash on
 *   `checklist_items.sha256` describes the stored object and a later
 *   substitution is detectable.
 */

/** Longest edge, in pixels, of an uploaded photo. */
const MAX_EDGE = 1600;
const QUALITY = 0.82;

export type PreparedPhoto = {
  blob: Blob;
  /** Lowercase hex SHA-256 of the bytes in `blob`. */
  sha256: string;
  width: number;
  height: number;
  /** When the photo was captured, as the device reported it. */
  takenAt: string;
};

export type GeoStamp = { latitude: number; longitude: number } | null;

/** Reads an image file into something a canvas can draw. */
async function decode(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if ("createImageBitmap" in window) {
    return createImageBitmap(file);
  }

  // Safari below 17 has no createImageBitmap for blobs.
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("could not read that image"));
      image.src = url;
    });
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function scaled(width: number, height: number): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= MAX_EDGE) return { width, height };
  const factor = MAX_EDGE / longest;
  return { width: Math.round(width * factor), height: Math.round(height * factor) };
}

/** Lowercase hex, which is what the `sha256` column holds. */
async function hash(blob: Blob): Promise<string> {
  const bytes = await blob.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Resizes to at most 1600px on the longest edge, re-encodes as JPEG, and
 * hashes the result.
 *
 * Re-encoding also strips the original EXIF, which carries the camera's own
 * GPS and serial number. We keep the location we asked for explicitly and
 * record it in a column, rather than shipping whatever metadata the phone
 * happened to embed.
 */
export async function preparePhoto(file: Blob): Promise<PreparedPhoto> {
  const source = await decode(file);
  const size = scaled(source.width, source.height);

  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("could not prepare that image");
  context.drawImage(source as CanvasImageSource, 0, 0, size.width, size.height);

  if ("close" in source) source.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", QUALITY)
  );
  if (!blob) throw new Error("could not compress that image");

  return {
    blob,
    sha256: await hash(blob),
    width: size.width,
    height: size.height,
    takenAt: new Date().toISOString(),
  };
}

/**
 * The device's location, if it will give it.
 *
 * Never blocks the capture: a member who declines the permission, or is
 * indoors with no fix, still gets to record the photo. A geo-stamp is
 * corroboration, not a gate — refusing the evidence because the GPS is weak
 * would be worse than evidence without coordinates.
 */
export function geoStamp(timeoutMs = 8000): Promise<GeoStamp> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60_000 }
    );
  });
}

/** A stable object key. The extension matters: the bucket filters on MIME type. */
export function photoKey(parts: string[]): string {
  const unique = crypto.randomUUID();
  return [...parts, `${unique}.jpg`].join("/");
}
