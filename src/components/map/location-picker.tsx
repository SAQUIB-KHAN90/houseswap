"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import type { Circle, Map as LeafletMap } from "leaflet";
import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { APPROX_RADIUS_M, TILES, centreFor } from "@/lib/map";

export type Point = { latitude: number; longitude: number };

/**
 * Where the host says their home roughly is.
 *
 * They place it themselves rather than it being geocoded from the address. A
 * geocoder would mean a second provider, a key and a bill, and it would be
 * guessing at an address the host has not been asked to make precise — while
 * the host knows exactly where their own home is.
 *
 * What is stored is deliberately imprecise: the database rounds it to about
 * 100 m and the circle shown is wider again, because this coordinate is public
 * and the street address is not.
 */
export function LocationPicker({
  city,
  value,
  onChange,
}: {
  city: string;
  value: Point | null;
  onChange: (point: Point | null) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const marker = useRef<Circle | null>(null);
  const [ready, setReady] = useState(false);

  // Kept in a ref so the map is built once: rebuilding it on every click would
  // throw away the pan and zoom the host just set.
  const handler = useRef(onChange);
  handler.current = onChange;

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const L = await import("leaflet");
      if (cancelled || !container.current || map.current) return;

      const instance = L.map(container.current, {
        center: value ? [value.latitude, value.longitude] : centreFor(city),
        zoom: value ? 14 : 11,
        scrollWheelZoom: false,
      });

      L.tileLayer(TILES.url, {
        attribution: TILES.attribution,
        maxZoom: TILES.maxZoom,
      }).addTo(instance);

      const draw = (lat: number, lng: number) => {
        marker.current?.remove();
        marker.current = L.circle([lat, lng], {
          radius: APPROX_RADIUS_M,
          color: "#13624E",
          weight: 2,
          fillColor: "#13624E",
          fillOpacity: 0.15,
        }).addTo(instance);
      };

      if (value) draw(value.latitude, value.longitude);

      instance.on("click", (event) => {
        const { lat, lng } = event.latlng;
        draw(lat, lng);
        handler.current({ latitude: lat, longitude: lng });
      });

      map.current = instance;
      setReady(true);
    })();

    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      marker.current = null;
    };
    // Only on mount: re-running would discard the host's pan and zoom.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recentre when the host changes city, as long as they have not placed a
  // point yet — moving a chosen one out from under them would be rude.
  useEffect(() => {
    if (!ready || !map.current || value) return;
    map.current.setView(centreFor(city), 11);
  }, [city, ready, value]);

  function clear() {
    marker.current?.remove();
    marker.current = null;
    onChange(null);
  }

  return (
    <div>
      <div
        ref={container}
        className="h-[280px] w-full rounded-lg border bg-[#eceae4]"
      />
      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2.5">
        <p className="flex items-center gap-1.5 text-sm text-muted">
          <MapPin className="size-4 shrink-0" aria-hidden />
          {value
            ? "Guests see this circle, not your address."
            : "Tap the map to show roughly where your home is."}
        </p>
        {value && (
          <Button type="button" variant="ghost" size="sm" onClick={clear}>
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}
