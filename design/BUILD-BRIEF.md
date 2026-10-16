# GUILD site: local rebuild of the Framer template

Goal: a Vite + React 19 + TypeScript + framer-motion site in `site/` that reproduces the Framer
project (Fantom AI template, remixed as GUILD) pixel-for-pixel on desktop, tablet and phone, with
every animation, and the GUILD copy already in place. Nothing is invented: every size, color,
radius, padding, gap, effect and transition comes from the export under `design/framer-export/`.

## Source of truth (read these, in this order)

1. `design/framer-export/condensed/section-<Name>.json`: the Desktop node tree for one section.
   Each node: `{ id, type, name, a: {attributes}, children }`. Attributes are Framer's:
   - layout: `layout: "stack"|"grid"`, `stackDirection`, `stackDistribution` (= justify-content),
     `stackAlignment` (= align-items), `gap`, `padding`, `width`/`height` (`1fr` = fill parent,
     `auto` = fit content, px fixed), `maxWidth`, `minHeight`, `position`, `overflow: "clip"`.
   - style: `fill` (color, `var(--token-…)`, or an image URL), `radius`, `border*`, `shadow`,
     `opacity`, `blur`/`backdropBlur`.
   - text: `RichTextNode` with `textStylePreset` ("Heading 1" … "Button text"), `textAlignment`,
     `maxWidth`; its `TextBlock > TextRun` children carry `text`. Copy must come from
     `site/src/content/guild.ts`, never typed by hand.
   - effects: `appearEffect` (enter opacity/scale + `transition` spec), `hoverEffect`,
     `loopEffect`, `scrollVariantEffect`. Transition specs like `spring-duration 1s 0.2 0.4s`
     are parsed by `site/src/lib/motion.ts#parseTransition`.
   - `ComponentInstanceNode`: `component` id + `$control__*` props. Local components live in
     `condensed/component-<Name>__<id>.json` (variants under `$variants`; variant copies of nodes
     are prefixed with the variant id). Code components are in `site/src/fx/*.tsx` (ported from
     the project) and `site/src/fx-ext/*.tsx` (re-implemented: TextWave, RippleLoader,
     ArcSpinner, SmoothScroll).
2. `design/framer-export/condensed/page-home.condensed.json` → `tablet_diff` and `phone_diff`:
   lists, per node id (same ids as desktop with prefix `PQb5vKiTZ` / `AqyDhCxuA`), the
   attributes that differ at that breakpoint. Use them for the media queries
   (`@media (max-width: 1199.98px)` tablet, `@media (max-width: 809.98px)` phone).
3. Screenshots of the finished Framer page (what it must look like):
   `/private/tmp/claude-501/-Users-adityakrx-guild-ai/47931b9a-de0c-4b5a-b20c-fe9b97caf2af/scratchpad/shots/v3.jpg`
   (1200px wide, full page) and crops `v2_0.jpg` … `v2_7.jpg` (2000px slices, earlier content).
4. `design/framer-export/asset-map.json`: Framer image URL → `/assets/<file>` (already in
   `site/public/assets`). Always use the local path.

## Conventions

- Tokens and text styles: `site/src/styles/tokens.css`. Use `var(--c-…)` aliases or the exact
  `var(--token-…)` ids from the export. Text classes `.h1 … .h6 .body1 .body2 .body3 .label .btn-text`.
- Styling: plain CSS Modules (`Section.module.css` next to the section) or inline styles. No Tailwind.
- Motion: `framer-motion` v14 (`motion.div`, `whileInView`, `AnimatePresence`, `useInView`).
  Appear effects: `site/src/lib/Appear.tsx` (`preset`: fade / fade-0.8 / fade-1 / pop / pop-0.4 /
  pop-0.6 / fade-fast, matching the export). Hover dim: `HOVER_DIM` in `lib/motion.ts`.
  Scroll-driven variant switching (Decisions tabs): `lib/useScrollTarget.ts`.
- Sections export a named component from `site/src/sections/<Name>.tsx` and render
  `<section id="…">` with the Framer `elementId` (hero, how-it-works, features, capabilities,
  partners, comparison, pricing, security, record, faqs). Anchor links use `/#id`.
- Shared UI goes in `site/src/ui/` (Button, Tag, SectionHeader, Card…). Only the Nav/Hero agent
  creates `ui/Button.tsx` and `ui/Tag.tsx`; others import them (API below).
- Code components in `site/src/fx/` take the same props as their `$control__` names in the
  export (camelCase without the prefix). Fix TypeScript errors inside them minimally; keep
  behavior.
- No em-dashes in copy. Sentence case. Fonts: headings Satoshi 500 (stand-in for PP Neue
  Montreal), body Geist.
- Run `npm run build` (in `site/`) before finishing; it must pass with zero TypeScript errors.
  Visual check: `npm run dev` then `node scripts/shot.mjs http://localhost:5173/ out.png`.

## Shared component APIs (owned by the Nav/Hero agent, stable contract)

```ts
// site/src/ui/Button.tsx
export function Button(props: { label: string; href: string; variant?: "primary" | "secondary" | "primary-light"; size?: "default" | "small"; icon?: boolean; light?: boolean }): JSX.Element
// site/src/ui/Tag.tsx  (section tag pill with icon; variant Inactive → Active on first in-view)
export function Tag(props: { title: string; icon?: React.ReactNode; dark?: boolean }): JSX.Element
// site/src/ui/SectionHeader.tsx (tag + heading + description, centered or left)
export function SectionHeader(props: { tag: string; heading: string; description?: string; align?: "center" | "left"; dark?: boolean; icon?: React.ReactNode }): JSX.Element
```

Until those exist, other agents may create a local fallback inside their own section file and
switch to the shared import at integration; do not create `ui/Button.tsx` yourself.

## Section tag icons (lucide-react names, matched to the Framer screenshots)

How it works `Command` · Decisions `LayoutGrid` · Verification `Anchor` · For partners `Activity` ·
Comparison `Tag` · Pricing `DollarSign` · Trust and controls `Shield` · The record `Award` ·
FAQs `TriangleAlert`. Other icons in the template: Button `ArrowRight`, nav `Menu`/`X`,
FAQ `Plus`/`Minus`, pricing list `CircleCheck`, UI card loading `Check`, prompt card
`Paperclip` `Mic` `Sparkles` `Search` `RefreshCw`.

## Dev server and screenshots

A Vite dev server for this site is already running at http://localhost:5174/ (HMR; do not start
another on that port, and never touch port 5173, which belongs to a different project).
Screenshot one section with Playwright (already installed):

```js
// node -e '…' or a scratch .mjs in site/scripts/
import { chromium } from "playwright";
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1200, height: 900 } });
await p.goto("http://localhost:5174/", { waitUntil: "networkidle" });
await p.locator("#how-it-works").scrollIntoViewIfNeeded(); await p.waitForTimeout(1500);
await p.locator("#how-it-works").screenshot({ path: "/tmp/how.png" }); await b.close();
```
Then open the PNG with the Read tool and compare against the Framer crop. Repeat at
viewport widths 1000 (tablet) and 390 (phone).

## File ownership (parallel build; do not edit files you do not own)

| Owner | Sections | Also owns |
|---|---|---|
| nav-hero | `sections/Nav.tsx` `Hero.tsx` `Logos.tsx` `Footer.tsx` | `ui/Button.tsx` `ui/Tag.tsx` `ui/SectionHeader.tsx`, `fx/LogoGrid.tsx`, `ui/PromptCard.tsx` |
| how | `sections/HowItWorks.tsx` | `fx/Typewriter.tsx` `fx/Animated_beam.tsx`, `ui/UiCardLoading.tsx` |
| decisions | `sections/Decisions.tsx` | `fx/Animated_lines.tsx`, `ui/ApprovalsCard.tsx` (the User roles card) |
| verify | `sections/Verification.tsx` `Partners.tsx` `Comparison.tsx` | `fx/Animated_lines_2.tsx` `fx/GrowthGraph.tsx` `fx/DottedIcon.tsx` |
| pricing | `sections/Pricing.tsx` `Trust.tsx` | `fx/SlotCounter.tsx`, `ui/PricingCard.tsx` `ui/Toggle.tsx` |
| record | `sections/Record.tsx` `Faq.tsx` | `fx/StaggerTestimonials.tsx`, `ui/FaqCard.tsx` |

Each section may add its own `*.module.css` beside it. Shared files in `lib/`, `styles/`,
`fx-ext/`, `content/` are frozen for this pass: if something is missing, add a local helper in
your own file and note it in your report.
