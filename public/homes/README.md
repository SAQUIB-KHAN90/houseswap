# Home photos

Drop image files in this folder, then run:

    npm run photos:index

That writes `src/lib/local-photos.ts`, and every listing without its own
uploaded photos will use these instead of the stock ones from Unsplash.

- Any `.jpg`, `.jpeg`, `.png` or `.webp`. Names do not matter.
- Landscape works best: cards are 20:17 and the listing header is 3:2.
- Eight or more gives enough variety that two listings rarely match.

These files are committed on purpose. `src/lib/local-photos.ts` names them, so
if they were not in the repository the build on Vercel would reference files
that are not there.

This is for the pilot. A real host uploads their own photos when they publish a
listing, and those always win over anything here.
