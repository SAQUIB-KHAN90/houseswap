"use client";

import { useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type PickedPhoto = { id: string; file: File; preview: string };

const MAX_PHOTOS = 8;

/**
 * Picking the photos for a listing.
 *
 * Nothing is uploaded here: the files are held until the listing is published,
 * because a photo needs a listing id to belong to and the bucket policy keys
 * on it. The form uploads them the moment the row exists.
 */
export function PhotoPicker({
  photos,
  onChange,
  disabled,
}: {
  photos: PickedPhoto[];
  onChange: (photos: PickedPhoto[]) => void;
  disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  function add(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);

    const room = MAX_PHOTOS - photos.length;
    const chosen = [...files].filter((f) => f.type.startsWith("image/"));

    if (chosen.length < files.length) {
      setError("Only image files can be added.");
    }
    if (chosen.length > room) {
      setError(`You can add ${MAX_PHOTOS} photos. The rest were skipped.`);
    }

    onChange([
      ...photos,
      ...chosen.slice(0, room).map((file) => ({
        id: crypto.randomUUID(),
        file,
        preview: URL.createObjectURL(file),
      })),
    ]);

    // Let the same file be picked again after being removed.
    if (input.current) input.current.value = "";
  }

  function remove(id: string) {
    const going = photos.find((p) => p.id === id);
    if (going) URL.revokeObjectURL(going.preview);
    onChange(photos.filter((p) => p.id !== id));
  }

  return (
    <div>
      {photos.length > 0 && (
        <ul className="mb-3.5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {photos.map((photo, index) => (
            <li key={photo.id} className="relative">
              <div className="aspect-[4/3] overflow-hidden rounded-md border bg-[#eceae4]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.preview}
                  alt={`Photo ${index + 1}`}
                  className="h-full w-full object-cover"
                />
              </div>
              {index === 0 && (
                <span className="absolute left-1.5 top-1.5 rounded-sm bg-white/95 px-2 py-0.5 text-xs font-semibold shadow-sm">
                  Cover
                </span>
              )}
              <button
                type="button"
                onClick={() => remove(photo.id)}
                disabled={disabled}
                aria-label={`Remove photo ${index + 1}`}
                className="absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-full bg-white/95 text-ink shadow-sm transition-colors hover:bg-white"
              >
                <X className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div
        className={cn(
          "grid place-items-center rounded-lg border-2 border-dashed border-field bg-surface px-6 py-9 text-center",
          disabled && "opacity-60"
        )}
      >
        <ImagePlus className="size-7 text-muted" aria-hidden />
        <p className="mt-3 font-semibold">
          {photos.length === 0 ? "Add a photo of each room" : `${photos.length} of ${MAX_PHOTOS} added`}
        </p>
        <p className="mt-1 max-w-sm text-sm text-muted">
          The first one is the cover. They are resized on your device before
          upload, so this works on a slow connection.
        </p>
        <input
          ref={input}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          onChange={(e) => add(e.target.files)}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-4"
          disabled={disabled || photos.length >= MAX_PHOTOS}
          onClick={() => input.current?.click()}
        >
          Choose photos
        </Button>
      </div>

      {error && (
        <p role="alert" className="mt-2.5 text-sm text-alert">
          {error}
        </p>
      )}
    </div>
  );
}
