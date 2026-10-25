"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type { Map as LeafletMap } from "leaflet";
import { APPROX_RADIUS_M, TILES, centreFor } from "@/lib/map";
import { cn } from "@/lib/utils";

export type MapPoint = {
  id: string;
  latitude: number;
  longitude: number;
  label: string;
  href?: string;
};

/**
 * A read-only map of roughly where homes are.
 *
 * Circles, never pins. The stored coordinate is rounded to about 100 m and the
 * circle is wider again, because a pin would claim a precision we do not have
 * and should not publish: the exact address is withheld until the host
 * approves a stay, and a map that gave the building away would walk straight
 * past that rule.
 *
 * Leaflet is imported inside the effect. It touches `window` as it loads, so a
 * top-level import would break the server render of any page holding a map.
 */
export function AreaMap({
  points,
  city,
  zoom,
  className,
}: {
  points: MapPoint[];
  /** Used to centre the map when there is nothing to show. */
  city?: string;
  zoom?: number;
  className?: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const L = await import("leaflet");
      if (cancelled || !container.current || map.current) return;

      const centre = points.length
        ? ([points[0].latitude, points[0].longitude] as [number, number])
        : centreFor(city);

      const instance = L.map(container.current, {
        center: centre,
        zoom: zoom ?? (points.length === 1 ? 14 : 11),
        scrollWheelZoom: false,
        attributionControl: true,
      });

      L.tileLayer(TILES.url, {
        attribution: TILES.attribution,
        maxZoom: TILES.maxZoom,
      }).addTo(instance);

      const circles = points.map((point) => {
        const circle = L.circle([point.latitude, point.longitude], {
          radius: APPROX_RADIUS_M,
          color: "#13624E",
          weight: 2,
          fillColor: "#13624E",
          fillOpacity: 0.15,
        }).addTo(instance);

        const label = point.href
          ? `<a href="${point.href}" style="color:#13624E;font-weight:600">${point.label}</a>`
          : point.label;
        circle.bindPopup(`${label}<br><span style="color:#6B665E">Approximate area</span>`);
        return circle;
      });

      // More than one home: frame them all rather than guessing a zoom.
      if (circles.length > 1) {
        instance.fitBounds(L.featureGroup(circles).getBounds().pad(0.2));
      }

      map.current = instance;
    })();

    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
  }, [points, city, zoom]);

  return (
    <div
      ref={container}
      role="img"
      aria-label={
        points.length === 1
          ? `Map of the area around ${points[0].label}`
          : `Map of ${points.length} homes`
      }
      className={cn("h-full w-full rounded-lg border bg-[#eceae4]", className)}
    />
  );
}
