import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Where the build output goes.
   *
   * A production build and a running `npm run dev` share `.next` by default,
   * and the build rewrites it underneath the dev server: its manifest then
   * points at chunks that no longer exist and the browser gets a
   * ChunkLoadError on the next navigation.
   *
   * So a verification build can be sent elsewhere with
   * `NEXT_DIST_DIR=.next-check` (that is what `npm run build:check` does) and
   * leave a dev server alone. Normal builds and deploys are untouched.
   */
  distDir: process.env.NEXT_DIST_DIR || ".next",

  /**
   * The floating Next.js badge in the corner, off.
   *
   * It only ever appears in development, never in a production build, so this
   * changes nothing about what a member sees. It is off because it sits on top
   * of the page while the layout is being judged, and a logo that is not ours
   * in the corner of every screenshot is a distraction.
   */
  devIndicators: false,

  /**
   * Hosts whose images this app will fetch and re-serve from its own origin.
   *
   * It is an allow-list, not a convenience: /_next/image would otherwise be an
   * open proxy that anyone could point at anything.
   *
   * Supabase is here because listing photos and signed evidence URLs come from
   * the project's storage domain, and they benefit from the same indirection —
   * one origin for every picture on the page.
   */
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
};

export default nextConfig;
