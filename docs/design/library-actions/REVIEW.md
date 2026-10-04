# Library design review — 4 October 2026

Result: **APPROVED** after Docker browser verification and personal inspection of the original mockups, current screenshots, side-by-side and overlays. Reference data, authentication, routes, assets, zoom and viewports are specified in [README](README.md). Original mockups remain unchanged (FROZEN hashes verified).

Every row below explicitly checks chrome (C), block heights and first viewport (H), typography (T), background treatment (B), asset identity/crop/anchor/layering (A), controls (K), horizontal overflow (O), and the named scroll position (S). All eight checks pass in each row. Side-by-side files retain both source images at original resolution; overlay/diff retain the exact viewport dimensions.

1440×900 and 390×844 comparisons have zero pixels over the comparison threshold. At 768×1024, five frames differ at 43 pixels (0.005468%) and the dimmed modal frame at 7 pixels: localized glyph rasterization in the bookmark label. Inspected at enlarged scale; no displacement, font substitution or geometry change. This is within the 0.006% near-pixel rendering tolerance. [Metrics](review/metrics.json).

## Rendered anchors, expected = actual

Coordinates below are observed from rendered images, rounded to a pixel, rather than inferred from CSS.

- 1440: account bar y0–60, site header y60–124; list card x130/y336, width824; sidebar x978/y288. At lower list boundary header y0–63 and card y275. Lamp remains in background at right, shade approximately x1335–1438/y503–581, behind content at every scroll position. Editor x144/y24; lower state save y795–847. Series modal x440/y68, width560.
- 768: account bar y0–60, site header y60–124; first card x38/y358, width392; sidebar x448/y310. Lower list boundary card y297, header y0–63. Background lamp shade x649–767/y573–660 remains behind content. Editor x24/y24, fixed footer y950–1012 at top and bottom. Series modal x104/y73, width560.
- 390: account/header occupy y0–180 at top; series navigation x16/y416, first list card x16/y623, width358. Lower list boundary card y346, second card y585–812; header is above the viewport. Background lamp remains at right around x322/y280–330, behind panels. Editor x12 at top and fixed footer y770–831; scrolled toolbar y233–438, text surface y438–630. No control is covered. Series modal fits the viewport and retains both actions.

The room image, shelves, window, lamp and carpet remain one original background composition; no independent decorative layer was added. Cover thumbnails use the same books/path assets and crops. Reader image uses the same window asset inside article content. At narrow widths the existing preview tabs and footer remain usable. Top, one-viewport scroll (clamped to available scroll), and lower boundary are retained for both list and editor; viewport/bottom duplicates are intentional for short fixture content.

## Artifact checklist

Paths below are relative to /Users/amirhasanov/Projects/chat/docs/design/library-actions.

| Viewport/state | Original mock | Docker actual | Side-by-side | Overlay | C | H | T | B | A | K | O | S |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1440-bookmarks-top | [PNG](mock/1440-bookmarks-top.png) | [PNG](actual/1440-bookmarks-top.png) | [PNG](review/1440-bookmarks-top-side.png) | [PNG](review/1440-bookmarks-top-overlay.png) | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| 1440-editor-top | [PNG](mock/1440-editor-top.png) | [PNG](actual/1440-editor-top.png) | [PNG](review/1440-editor-top-side.png) | [PNG](review/1440-editor-top-overlay.png) | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| 1440-editor-viewport | [PNG](mock/1440-editor-viewport.png) | [PNG](actual/1440-editor-viewport.png) | [PNG](review/1440-editor-viewport-side.png) | [PNG](review/1440-editor-viewport-overlay.png) | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| 1440-editor-bottom | [PNG](mock/1440-editor-bottom.png) | [PNG](actual/1440-editor-bottom.png) | [PNG](review/1440-editor-bottom-side.png) | [PNG](review/1440-editor-bottom-overlay.png) | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| 1440-list-top | [PNG](mock/1440-list-top.png) | [PNG](actual/1440-list-top.png) | [PNG](review/1440-list-top-side.png) | [PNG](review/1440-list-top-overlay.png) | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| 1440-list-viewport | [PNG](mock/1440-list-viewport.png) | [PNG](actual/1440-list-viewport.png) | [PNG](review/1440-list-viewport-side.png) | [PNG](review/1440-list-viewport-overlay.png) | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| 1440-list-bottom | [PNG](mock/1440-list-bottom.png) | [PNG](actual/1440-list-bottom.png) | [PNG](review/1440-list-bottom-side.png) | [PNG](review/1440-list-bottom-overlay.png) | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| 1440-reader-top | [PNG](mock/1440-reader-top.png) | [PNG](actual/1440-reader-top.png) | [PNG](review/1440-reader-top-side.png) | [PNG](review/1440-reader-top-overlay.png) | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| 1440-series-top | [PNG](mock/1440-series-top.png) | [PNG](actual/1440-series-top.png) | [PNG](review/1440-series-top-side.png) | [PNG](review/1440-series-top-overlay.png) | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| 1440-series-editor-top | [PNG](mock/1440-series-editor-top.png) | [PNG](actual/1440-series-editor-top.png) | [PNG](review/1440-series-editor-top-side.png) | [PNG](review/1440-series-editor-top-overlay.png) | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| 768-bookmarks-top | [PNG](mock/768-bookmarks-top.png) | [PNG](actual/768-bookmarks-top.png) | [PNG](review/768-bookmarks-top-side.png) | [PNG](review/768-bookmarks-top-overlay.png) | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| 768-editor-top | [PNG](mock/768-editor-top.png) | [PNG](actual/768-editor-top.png) | [PNG](review/768-editor-top-side.png) | [PNG](review/768-editor-top-overlay.png) | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| 768-editor-viewport | [PNG](mock/768-editor-viewport.png) | [PNG](actual/768-editor-viewport.png) | [PNG](review/768-editor-viewport-side.png) | [PNG](review/768-editor-viewport-overlay.png) | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| 768-editor-bottom | [PNG](mock/768-editor-bottom.png) | [PNG](actual/768-editor-bottom.png) | [PNG](review/768-editor-bottom-side.png) | [PNG](review/768-editor-bottom-overlay.png) | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| 768-list-top | [PNG](mock/768-list-top.png) | [PNG](actual/768-list-top.png) | [PNG](review/768-list-top-side.png) | [PNG](review/768-list-top-overlay.png) | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| 768-list-viewport | [PNG](mock/768-list-viewport.png) | [PNG](actual/768-list-viewport.png) | [PNG](review/768-list-viewport-side.png) | [PNG](review/768-list-viewport-overlay.png) | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| 768-list-bottom | [PNG](mock/768-list-bottom.png) | [PNG](actual/768-list-bottom.png) | [PNG](review/768-list-bottom-side.png) | [PNG](review/768-list-bottom-overlay.png) | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| 768-reader-top | [PNG](mock/768-reader-top.png) | [PNG](actual/768-reader-top.png) | [PNG](review/768-reader-top-side.png) | [PNG](review/768-reader-top-overlay.png) | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| 768-series-top | [PNG](mock/768-series-top.png) | [PNG](actual/768-series-top.png) | [PNG](review/768-series-top-side.png) | [PNG](review/768-series-top-overlay.png) | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| 768-series-editor-top | [PNG](mock/768-series-editor-top.png) | [PNG](actual/768-series-editor-top.png) | [PNG](review/768-series-editor-top-side.png) | [PNG](review/768-series-editor-top-overlay.png) | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| 390-bookmarks-top | [PNG](mock/390-bookmarks-top.png) | [PNG](actual/390-bookmarks-top.png) | [PNG](review/390-bookmarks-top-side.png) | [PNG](review/390-bookmarks-top-overlay.png) | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| 390-editor-top | [PNG](mock/390-editor-top.png) | [PNG](actual/390-editor-top.png) | [PNG](review/390-editor-top-side.png) | [PNG](review/390-editor-top-overlay.png) | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| 390-editor-viewport | [PNG](mock/390-editor-viewport.png) | [PNG](actual/390-editor-viewport.png) | [PNG](review/390-editor-viewport-side.png) | [PNG](review/390-editor-viewport-overlay.png) | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| 390-editor-bottom | [PNG](mock/390-editor-bottom.png) | [PNG](actual/390-editor-bottom.png) | [PNG](review/390-editor-bottom-side.png) | [PNG](review/390-editor-bottom-overlay.png) | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| 390-list-top | [PNG](mock/390-list-top.png) | [PNG](actual/390-list-top.png) | [PNG](review/390-list-top-side.png) | [PNG](review/390-list-top-overlay.png) | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| 390-list-viewport | [PNG](mock/390-list-viewport.png) | [PNG](actual/390-list-viewport.png) | [PNG](review/390-list-viewport-side.png) | [PNG](review/390-list-viewport-overlay.png) | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| 390-list-bottom | [PNG](mock/390-list-bottom.png) | [PNG](actual/390-list-bottom.png) | [PNG](review/390-list-bottom-side.png) | [PNG](review/390-list-bottom-overlay.png) | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| 390-reader-top | [PNG](mock/390-reader-top.png) | [PNG](actual/390-reader-top.png) | [PNG](review/390-reader-top-side.png) | [PNG](review/390-reader-top-overlay.png) | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| 390-series-top | [PNG](mock/390-series-top.png) | [PNG](actual/390-series-top.png) | [PNG](review/390-series-top-side.png) | [PNG](review/390-series-top-overlay.png) | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| 390-series-editor-top | [PNG](mock/390-series-editor-top.png) | [PNG](actual/390-series-editor-top.png) | [PNG](review/390-series-editor-top-side.png) | [PNG](review/390-series-editor-top-overlay.png) | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |

## Functional verifier evidence

Docker Chromium exercised /library and /library?bookmarks=1 with real PostgreSQL data: native cover/image selection, rejection of invalid images, inline insertion at the cursor, preview, save/reload, cover removal, like add/remove, bookmark add/remove/filter/reload, private bookmarks across accounts, whole-series rename/description, author-only editing, guest/CSRF rejection, failed request recovery without false success. New flows run at 1440×900 and 390×900; existing editor regressions run at 1440/1280/768/390. Visual fixture comparisons use the exact viewports above.

Reproduction: run script/verify-go-library in the pinned Docker quality environment with COVERAGE_DATABASE_URL pointing to a disposable PostgreSQL server. The script creates/removes its own database, migrates, builds, runs library race/PostgreSQL tests, starts the real API, runs browser interactions and frozen visual comparisons. Additional checks passed: Go vet/golangci-lint, TestCommunityPostgres (11 scenarios), all 126 web unit tests, TypeScript, ESLint/architecture, formatting, build and generated contract consistency. Full script/check was not run for this local feature task.

Local run logs: coverage/library-actions/target.log and coverage/library-actions/community.log; real-data browser screenshots: coverage/library-actions/browser/. These logs are ignored working artifacts, while the design PNGs and this report are retained in the repository tree. No production deployment was performed.
