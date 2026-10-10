# Landing copy handoff — 2026-10-10

Frozen before implementation. Source copy: `copy.json`. Mockups change only text and directory content in the existing Docker-rendered DOM, without changing production source or CSS. Current navigation, registration form, background, image, fonts, grids, responsive breakpoints, spacing, borders and controls remain the baseline.

## Artifact contract

Absolute root: `/Users/amirhasanov/Projects/chat/docs/design/landing-copy-20261010/`.

Route `/`, Docker origin `http://127.0.0.1:4097`, fresh guest with empty local/session storage, login form untouched, no dynamic content fixture needed. Chromium in pinned project Docker, zoom 100%, device scale 1, reduced motion. Desktop 1440×900, tablet 768×1024, mobile 390×844. Each has `baseline/{size}-full.png`, `mock/{size}-full.png`, plus exact viewport images `{size}-top.png`, `{size}-middle.png`, `{size}-bottom.png` at scroll 0, one viewport height, and lower document boundary. Detailed rendered height/overflow/assets recorded in `mock/manifest.json`.

Assets retained: `apps/web/public/images/vertigo-poster.png`, `/fonts/oswald-variable.ttf` (Vertigo Display), `/fonts/manrope-variable.ttf` (Vertigo Text), existing inline SVG Icon paths and CSS Vertigo mark. The current CSS in `apps/web/css/landing.css` and `site.css` is the fidelity reference. Poster sizing/crop/anchor/layering is unchanged at every breakpoint. All 12 directory cards follow existing element and icon structure; no new visual system.

## Design decisions

Keep the two feature cards and replace unavailable game links with actual Tetris and geo-game help links, rankings CTA. Extend the existing directory to 12 cards (four rows desktop/tablet and one column mobile); do not introduce new grids or type scales. Preserve feature chat bubbles. Hero becomes a single real-text paragraph; do not insert the former forced line breaks. Keep existing benefits headings, replacing only explanatory paragraphs. New cards use existing icons and `size-6`.

## Acceptance — required at every viewport

- PASS only if global header/navigation, untouched entrance controls and footer match baseline.
- PASS only if `mock` and Docker `current` have equal dimensions/data/auth, matching first viewport and block heights.
- PASS only if fonts, weight, line height, alignment, widths, grid boundaries and spacing match mock.
- PASS only if original poster identity/crop/anchor/layering, gradients and background match mock.
- PASS only if exact copy and link text match `copy.json`; all CTAs retain existing style and focus treatment.
- PASS only if no horizontal overflow, clipped copy or controls, overlapping content at all three viewports.
- PASS only if top/middle/bottom scroll states match. No added scroll-sensitive layers.
- Final review requires original mock PNG, current Docker PNG, side-by-side plus diff for every view. Missing artifacts or visible drift means REJECTED.

PNG mockups personally inspected by designer before freezing. Final design acceptance remains pending main-agent verifier evidence.
