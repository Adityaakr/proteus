# Proteus AI site

Local rebuild of the Proteus AI marketing page (originally designed in Framer, remix of the
Fantom AI template). Vite + React 19 + TypeScript + framer-motion + Lenis.

```bash
npm install
npm run dev        # http://localhost:5173 (pick another port with --port)
npm run build      # production bundle in dist/
npm run preview    # serve dist/
npm run shot -- http://localhost:5174/ shot.png   # full-page screenshot (Playwright)
```

## Layout

- `src/content/proteus.ts` — every line of copy on the page. Edit text here only.
- `src/sections/*` — one component per page section, in page order (see `src/App.tsx`).
- `src/ui/*` — shared pieces (Button, Tag, SectionHeader, cards).
- `src/fx/*` — code components exported from the Framer project, unchanged apart from a
  local `framer` shim (`src/lib/framer-shim.ts`).
- `src/fx-ext/*` — re-implementations of Framer marketplace components the template used
  (Lenis smooth scroll, Text Wave, Ripple Loader, Arc Spinner).
- `src/styles/tokens.css` — color tokens and text styles from the Framer project.
- `public/assets` — images and video from the Framer project; `public/fonts` — Geist and Satoshi.

The Framer export the build was made from lives in `../design/framer-export`
(`condensed/` holds a per-section node tree plus tablet and phone diffs).

## Fonts

Headings in the Framer template use PP Neue Montreal, a commercial typeface. This build ships
Satoshi (free, Fontshare) in its place. To use PP Neue Montreal, drop the woff2 files in
`public/fonts` and update the `@font-face` rules at the top of `src/styles/tokens.css`.

## Hosting

The built site (`pnpm --filter proteus-site build` → `site/dist`) is served by the API process on the same origin in the Railway deployment (start command: `cd server && node_modules/.bin/tsx scripts/start-prod.ts`); see `DEPLOYMENT.md` at the repo root. A Railway service whose watch path is limited to `site/` only redeploys when this folder changes; clear the watch path in the service settings so server changes deploy too.

Hosted on Railway as a single service: the API serves the built site. The hosted market is seeded by `server/scripts/bootstrap.ts` on boot.
