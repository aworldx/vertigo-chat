# Landing copy — final design review

**APPROVED** — 2026-10-10. Designer personally opened every original mock, current Docker image, side-by-side and pixel diff listed below during this review turn, after main-agent verifier PASS. No missing artifacts, viewport/data/auth differences or unresolved visual comments.

Main-agent verifier evidence: Docker Chromium direct `/` and reload on all three viewports; all 12 directory links, two game links and rankings clicked, destination HTTP 200 and help anchors opened; registration toggle and guest entry/message scenario passed; console errors absent. This review separately assesses visual fidelity.

Frozen SHA-256 validation: all 12 original mock PNGs and `copy.json` OK. Pixel comparison is exact for all 12 pairs: zero changed pixels and maximum channel difference 0. Fresh guest, untouched login form, zoom 100%, device scale 1 and reduced motion match both manifests. Overflow: scroll width equals viewport width for 1440, 768 and 390.

## Artifact-by-artifact checklist

Paths below are relative to `/Users/amirhasanov/Projects/chat/docs/design/landing-copy-20261010/`. Side-by-side panels each retain the source image dimensions; comparison canvas is twice source width. Full-page images retain document height. Each result explicitly covers chrome; block heights and first viewport; typography; background; poster identity/crop/anchor/layering and logo/icons; controls; overflow; scroll state.

| View and scroll | Original mock | Current Docker | Side-by-side + diff | Chrome | Heights / first viewport | Typography | Background | Assets | Controls | Overflow | Scroll |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1440x900 full document | `mock/1440x900-full.png` | `current/1440x900-full.png` | `comparison/1440x900-full-side.png` + `comparison/1440x900-full-diff.png` | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| 1440x900 y=0 | `mock/1440x900-top.png` | `current/1440x900-top.png` | `comparison/1440x900-top-side.png` + `comparison/1440x900-top-diff.png` | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| 1440x900 y=900 | `mock/1440x900-middle.png` | `current/1440x900-middle.png` | `comparison/1440x900-middle-side.png` + `comparison/1440x900-middle-diff.png` | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| 1440x900 y=2916 | `mock/1440x900-bottom.png` | `current/1440x900-bottom.png` | `comparison/1440x900-bottom-side.png` + `comparison/1440x900-bottom-diff.png` | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| 768x1024 full document | `mock/768x1024-full.png` | `current/768x1024-full.png` | `comparison/768x1024-full-side.png` + `comparison/768x1024-full-diff.png` | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| 768x1024 y=0 | `mock/768x1024-top.png` | `current/768x1024-top.png` | `comparison/768x1024-top-side.png` + `comparison/768x1024-top-diff.png` | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| 768x1024 y=1024 | `mock/768x1024-middle.png` | `current/768x1024-middle.png` | `comparison/768x1024-middle-side.png` + `comparison/768x1024-middle-diff.png` | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| 768x1024 y=3055 | `mock/768x1024-bottom.png` | `current/768x1024-bottom.png` | `comparison/768x1024-bottom-side.png` + `comparison/768x1024-bottom-diff.png` | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| 390x844 full document | `mock/390x844-full.png` | `current/390x844-full.png` | `comparison/390x844-full-side.png` + `comparison/390x844-full-diff.png` | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| 390x844 y=0 | `mock/390x844-top.png` | `current/390x844-top.png` | `comparison/390x844-top-side.png` + `comparison/390x844-top-diff.png` | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| 390x844 y=844 | `mock/390x844-middle.png` | `current/390x844-middle.png` | `comparison/390x844-middle-side.png` + `comparison/390x844-middle-diff.png` | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| 390x844 y=6005 | `mock/390x844-bottom.png` | `current/390x844-bottom.png` | `comparison/390x844-bottom-side.png` + `comparison/390x844-bottom-diff.png` | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |

## Rendered position evidence

At scroll 0, desktop header is the top band, hero copy occupies the left and poster the right; registration begins within the lower first viewport. Tablet retains the same header and two-column registration structure; poster remains within the hero. Mobile header is at top, cropped poster sits above/behind hero copy, all introductory text and both hero CTAs are visible before registration starts. These positions match the original mock exactly.

At one viewport of scroll (900 / 1024 / 844), header and poster are naturally above view; registration content and entrance form appear in the original two-column desktop/tablet or single-column mobile composition. At lower boundary (2916 / 3055 / 6005), final directory row, finale logo and controls, footer remain in their original positions with no overlap or excessive blank area. The full-page comparisons cover every added directory row, including the two real-game links. No decorative or fixed/sticky layer was introduced.

Desktop/tablet four-row directory and mobile twelve-row directory match their frozen layouts. No fallback fonts, changed poster crop, changed navigation, clipped descriptions, altered card geometry, or unapproved controls were found. No implementation corrections remain.
