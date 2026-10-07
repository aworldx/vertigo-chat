# Geo 0.24.1 final review

APPROVED - 2026-10-07. Earlier approval of the affected panel was revoked after the user screenshots. v6/v8 and v7 expanded-player states are REJECTED: duplicated player strip and insufficient height. Final references: v7 compact layout plus v9 single expanded player / landscape inline media. Each proposal was rendered on original frontend 48e2241 before its implementation. Original files are retained. Stable-reference captures only wait for virtualized chat rendering, without changing the proposal. Native audio is seeked to 2 seconds in both old and current builds before capture.

## Docker verification

- script/verify-go-geo: domain/application/HTTP/PostgreSQL race, browser direct route/reload, five rounds, private/replaced answers, closed/collapsed entry, unconfigured provider: PASS.
- geo-player-verification: autumn and vertigo_glass across 1440x900, 1280x678, 1024x678, 768x1024, 390x844, 844x390, 390x544, 320x740. Collapse/open/expand/close, hidden sidebar, no implicit column, preserved mounted desktop media/playback, answer, no Karmik interception, inline portrait/landscape and no overflow: PASS (16 combinations).
- Neighbor player browser: music/video, queue/reordering/scroll, volume, retry, preferences, modes, inline portrait/landscape, 480/481px height boundary: PASS.
- 141 frontend unit tests, TypeScript, ESLint/architecture, Prettier, build: PASS in pinned Linux Docker. Full script/check not run.

## Visual evidence

Route /chat, guest, device scale 1, glass theme. Same 3 peers / 7 chat rows / round 2 / 04:38 fixture. Image reference-v1/assets/location.jpg, existing theme and font assets. Explicit SDK fixture; this is not a new Google walking test.

All 99 rows were personally inspected using contact sheets containing original mock, current Docker screenshot, side-by-side and overlay for top/viewport/bottom scroll states. Full-size representative desktop/tablet/mobile/short/landscape images were also opened. Full PNGs are retained on the host; contact sheets do not replace them. Every row has 0 changed pixels at 3% channel tolerance, equal dimensions/auth/data and no horizontal overflow.

Rendered positions: chrome at top and composer at bottom. Game right of conversation on desktop and landscape; above conversation on portrait/tablet. Enlarged game retains viewport gutters. Compact answer footer below panorama. Background illustration preserves its bottom-right anchor/crop/layering. Karmik hit area is hidden while game is open. Expanded player is one left popup with no second strip; landscape uses inline media. On tablet the explicitly opened player popup can temporarily cover part of the game and can be collapsed using its own control.

Each row explicitly checks chrome, heights/first viewport, typography, background, asset identity/crop/anchor/layering, controls, overflow and its scroll state.

### 1440x900-place-top.png - PASS

Chrome PASS; heights/first viewport PASS; typography PASS; background PASS; asset identity/crop/anchor/layering PASS; controls PASS; overflow PASS; scroll top PASS.

- [Mock](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v7/vertigo_glass/mock/1440x900-place-top.png)
- [Docker](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/actual/1440x900-place-top.png)
- [Side-by-side](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1440x900-place-top-side.png)
- [Overlay](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1440x900-place-top-overlay.png)
- [Diff](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1440x900-place-top-diff.png)

### 1440x900-place-viewport.png - PASS

Chrome PASS; heights/first viewport PASS; typography PASS; background PASS; asset identity/crop/anchor/layering PASS; controls PASS; overflow PASS; scroll viewport PASS.

- [Mock](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v7/vertigo_glass/mock/1440x900-place-viewport.png)
- [Docker](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/actual/1440x900-place-viewport.png)
- [Side-by-side](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1440x900-place-viewport-side.png)
- [Overlay](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1440x900-place-viewport-overlay.png)
- [Diff](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1440x900-place-viewport-diff.png)

### 1440x900-place-bottom.png - PASS

Chrome PASS; heights/first viewport PASS; typography PASS; background PASS; asset identity/crop/anchor/layering PASS; controls PASS; overflow PASS; scroll bottom PASS.

- [Mock](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v7/vertigo_glass/mock/1440x900-place-bottom.png)
- [Docker](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/actual/1440x900-place-bottom.png)
- [Side-by-side](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1440x900-place-bottom-side.png)
- [Overlay](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1440x900-place-bottom-overlay.png)
- [Diff](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1440x900-place-bottom-diff.png)

### 1440x900-answered-top.png - PASS

Chrome PASS; heights/first viewport PASS; typography PASS; background PASS; asset identity/crop/anchor/layering PASS; controls PASS; overflow PASS; scroll top PASS.

- [Mock](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v7/vertigo_glass/mock/1440x900-answered-top.png)
- [Docker](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/actual/1440x900-answered-top.png)
- [Side-by-side](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1440x900-answered-top-side.png)
- [Overlay](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1440x900-answered-top-overlay.png)
- [Diff](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1440x900-answered-top-diff.png)

### 1440x900-answered-viewport.png - PASS

Chrome PASS; heights/first viewport PASS; typography PASS; background PASS; asset identity/crop/anchor/layering PASS; controls PASS; overflow PASS; scroll viewport PASS.

- [Mock](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v7/vertigo_glass/mock/1440x900-answered-viewport.png)
- [Docker](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/actual/1440x900-answered-viewport.png)
- [Side-by-side](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1440x900-answered-viewport-side.png)
- [Overlay](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1440x900-answered-viewport-overlay.png)
- [Diff](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1440x900-answered-viewport-diff.png)

### 1440x900-answered-bottom.png - PASS

Chrome PASS; heights/first viewport PASS; typography PASS; background PASS; asset identity/crop/anchor/layering PASS; controls PASS; overflow PASS; scroll bottom PASS.

- [Mock](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v7/vertigo_glass/mock/1440x900-answered-bottom.png)
- [Docker](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/actual/1440x900-answered-bottom.png)
- [Side-by-side](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1440x900-answered-bottom-side.png)
- [Overlay](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1440x900-answered-bottom-overlay.png)
- [Diff](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1440x900-answered-bottom-diff.png)

### 1440x900-answered-expanded-top.png - PASS

Chrome PASS; heights/first viewport PASS; typography PASS; background PASS; asset identity/crop/anchor/layering PASS; controls PASS; overflow PASS; scroll top PASS.

- [Mock](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v7/vertigo_glass/mock/1440x900-answered-expanded-top.png)
- [Docker](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/actual/1440x900-answered-expanded-top.png)
- [Side-by-side](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1440x900-answered-expanded-top-side.png)
- [Overlay](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1440x900-answered-expanded-top-overlay.png)
- [Diff](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1440x900-answered-expanded-top-diff.png)

### 1440x900-answered-expanded-viewport.png - PASS

Chrome PASS; heights/first viewport PASS; typography PASS; background PASS; asset identity/crop/anchor/layering PASS; controls PASS; overflow PASS; scroll viewport PASS.

- [Mock](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v7/vertigo_glass/mock/1440x900-answered-expanded-viewport.png)
- [Docker](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/actual/1440x900-answered-expanded-viewport.png)
- [Side-by-side](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1440x900-answered-expanded-viewport-side.png)
- [Overlay](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1440x900-answered-expanded-viewport-overlay.png)
- [Diff](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1440x900-answered-expanded-viewport-diff.png)

### 1440x900-answered-expanded-bottom.png - PASS

Chrome PASS; heights/first viewport PASS; typography PASS; background PASS; asset identity/crop/anchor/layering PASS; controls PASS; overflow PASS; scroll bottom PASS.

- [Mock](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v7/vertigo_glass/mock/1440x900-answered-expanded-bottom.png)
- [Docker](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/actual/1440x900-answered-expanded-bottom.png)
- [Side-by-side](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1440x900-answered-expanded-bottom-side.png)
- [Overlay](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1440x900-answered-expanded-bottom-overlay.png)
- [Diff](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1440x900-answered-expanded-bottom-diff.png)

### 1440x900-player-compact-top.png - PASS

Chrome PASS; heights/first viewport PASS; typography PASS; background PASS; asset identity/crop/anchor/layering PASS; controls PASS; overflow PASS; scroll top PASS.

- [Mock](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v7/vertigo_glass/mock/1440x900-player-compact-top.png)
- [Docker](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/actual/1440x900-player-compact-top.png)
- [Side-by-side](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1440x900-player-compact-top-side.png)
- [Overlay](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1440x900-player-compact-top-overlay.png)
- [Diff](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1440x900-player-compact-top-diff.png)

### 1440x900-player-compact-viewport.png - PASS

Chrome PASS; heights/first viewport PASS; typography PASS; background PASS; asset identity/crop/anchor/layering PASS; controls PASS; overflow PASS; scroll viewport PASS.

- [Mock](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v7/vertigo_glass/mock/1440x900-player-compact-viewport.png)
- [Docker](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/actual/1440x900-player-compact-viewport.png)
- [Side-by-side](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1440x900-player-compact-viewport-side.png)
- [Overlay](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1440x900-player-compact-viewport-overlay.png)
- [Diff](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1440x900-player-compact-viewport-diff.png)

### 1440x900-player-compact-bottom.png - PASS

Chrome PASS; heights/first viewport PASS; typography PASS; background PASS; asset identity/crop/anchor/layering PASS; controls PASS; overflow PASS; scroll bottom PASS.

- [Mock](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v7/vertigo_glass/mock/1440x900-player-compact-bottom.png)
- [Docker](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/actual/1440x900-player-compact-bottom.png)
- [Side-by-side](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1440x900-player-compact-bottom-side.png)
- [Overlay](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1440x900-player-compact-bottom-overlay.png)
- [Diff](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1440x900-player-compact-bottom-diff.png)

### 1440x900-player-expanded-top.png - PASS

Chrome PASS; heights/first viewport PASS; typography PASS; background PASS; asset identity/crop/anchor/layering PASS; controls PASS; overflow PASS; scroll top PASS.

- [Mock](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v9/vertigo_glass/mock/1440x900-player-expanded-top.png)
- [Docker](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/actual/1440x900-player-expanded-top.png)
- [Side-by-side](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1440x900-player-expanded-top-side.png)
- [Overlay](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1440x900-player-expanded-top-overlay.png)
- [Diff](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1440x900-player-expanded-top-diff.png)

### 1440x900-player-expanded-viewport.png - PASS

Chrome PASS; heights/first viewport PASS; typography PASS; background PASS; asset identity/crop/anchor/layering PASS; controls PASS; overflow PASS; scroll viewport PASS.

- [Mock](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v9/vertigo_glass/mock/1440x900-player-expanded-viewport.png)
- [Docker](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/actual/1440x900-player-expanded-viewport.png)
- [Side-by-side](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1440x900-player-expanded-viewport-side.png)
- [Overlay](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1440x900-player-expanded-viewport-overlay.png)
- [Diff](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1440x900-player-expanded-viewport-diff.png)

### 1440x900-player-expanded-bottom.png - PASS

Chrome PASS; heights/first viewport PASS; typography PASS; background PASS; asset identity/crop/anchor/layering PASS; controls PASS; overflow PASS; scroll bottom PASS.

- [Mock](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v9/vertigo_glass/mock/1440x900-player-expanded-bottom.png)
- [Docker](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/actual/1440x900-player-expanded-bottom.png)
- [Side-by-side](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1440x900-player-expanded-bottom-side.png)
- [Overlay](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1440x900-player-expanded-bottom-overlay.png)
- [Diff](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1440x900-player-expanded-bottom-diff.png)

### 1280x678-place-top.png - PASS

Chrome PASS; heights/first viewport PASS; typography PASS; background PASS; asset identity/crop/anchor/layering PASS; controls PASS; overflow PASS; scroll top PASS.

- [Mock](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v7/vertigo_glass/mock/1280x678-place-top.png)
- [Docker](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/actual/1280x678-place-top.png)
- [Side-by-side](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1280x678-place-top-side.png)
- [Overlay](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1280x678-place-top-overlay.png)
- [Diff](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1280x678-place-top-diff.png)

### 1280x678-place-viewport.png - PASS

Chrome PASS; heights/first viewport PASS; typography PASS; background PASS; asset identity/crop/anchor/layering PASS; controls PASS; overflow PASS; scroll viewport PASS.

- [Mock](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v7/vertigo_glass/mock/1280x678-place-viewport.png)
- [Docker](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/actual/1280x678-place-viewport.png)
- [Side-by-side](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1280x678-place-viewport-side.png)
- [Overlay](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1280x678-place-viewport-overlay.png)
- [Diff](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1280x678-place-viewport-diff.png)

### 1280x678-place-bottom.png - PASS

Chrome PASS; heights/first viewport PASS; typography PASS; background PASS; asset identity/crop/anchor/layering PASS; controls PASS; overflow PASS; scroll bottom PASS.

- [Mock](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v7/vertigo_glass/mock/1280x678-place-bottom.png)
- [Docker](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/actual/1280x678-place-bottom.png)
- [Side-by-side](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1280x678-place-bottom-side.png)
- [Overlay](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1280x678-place-bottom-overlay.png)
- [Diff](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1280x678-place-bottom-diff.png)

### 1280x678-answered-top.png - PASS

Chrome PASS; heights/first viewport PASS; typography PASS; background PASS; asset identity/crop/anchor/layering PASS; controls PASS; overflow PASS; scroll top PASS.

- [Mock](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v7/vertigo_glass/mock/1280x678-answered-top.png)
- [Docker](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/actual/1280x678-answered-top.png)
- [Side-by-side](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1280x678-answered-top-side.png)
- [Overlay](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1280x678-answered-top-overlay.png)
- [Diff](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1280x678-answered-top-diff.png)

### 1280x678-answered-viewport.png - PASS

Chrome PASS; heights/first viewport PASS; typography PASS; background PASS; asset identity/crop/anchor/layering PASS; controls PASS; overflow PASS; scroll viewport PASS.

- [Mock](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v7/vertigo_glass/mock/1280x678-answered-viewport.png)
- [Docker](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/actual/1280x678-answered-viewport.png)
- [Side-by-side](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1280x678-answered-viewport-side.png)
- [Overlay](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1280x678-answered-viewport-overlay.png)
- [Diff](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1280x678-answered-viewport-diff.png)

### 1280x678-answered-bottom.png - PASS

Chrome PASS; heights/first viewport PASS; typography PASS; background PASS; asset identity/crop/anchor/layering PASS; controls PASS; overflow PASS; scroll bottom PASS.

- [Mock](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v7/vertigo_glass/mock/1280x678-answered-bottom.png)
- [Docker](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/actual/1280x678-answered-bottom.png)
- [Side-by-side](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1280x678-answered-bottom-side.png)
- [Overlay](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1280x678-answered-bottom-overlay.png)
- [Diff](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1280x678-answered-bottom-diff.png)

### 1280x678-answered-expanded-top.png - PASS

Chrome PASS; heights/first viewport PASS; typography PASS; background PASS; asset identity/crop/anchor/layering PASS; controls PASS; overflow PASS; scroll top PASS.

- [Mock](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v7/vertigo_glass/mock/1280x678-answered-expanded-top.png)
- [Docker](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/actual/1280x678-answered-expanded-top.png)
- [Side-by-side](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1280x678-answered-expanded-top-side.png)
- [Overlay](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1280x678-answered-expanded-top-overlay.png)
- [Diff](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1280x678-answered-expanded-top-diff.png)

### 1280x678-answered-expanded-viewport.png - PASS

Chrome PASS; heights/first viewport PASS; typography PASS; background PASS; asset identity/crop/anchor/layering PASS; controls PASS; overflow PASS; scroll viewport PASS.

- [Mock](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v7/vertigo_glass/mock/1280x678-answered-expanded-viewport.png)
- [Docker](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/actual/1280x678-answered-expanded-viewport.png)
- [Side-by-side](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1280x678-answered-expanded-viewport-side.png)
- [Overlay](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1280x678-answered-expanded-viewport-overlay.png)
- [Diff](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1280x678-answered-expanded-viewport-diff.png)

### 1280x678-answered-expanded-bottom.png - PASS

Chrome PASS; heights/first viewport PASS; typography PASS; background PASS; asset identity/crop/anchor/layering PASS; controls PASS; overflow PASS; scroll bottom PASS.

- [Mock](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v7/vertigo_glass/mock/1280x678-answered-expanded-bottom.png)
- [Docker](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/actual/1280x678-answered-expanded-bottom.png)
- [Side-by-side](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1280x678-answered-expanded-bottom-side.png)
- [Overlay](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1280x678-answered-expanded-bottom-overlay.png)
- [Diff](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1280x678-answered-expanded-bottom-diff.png)

### 1280x678-player-compact-top.png - PASS

Chrome PASS; heights/first viewport PASS; typography PASS; background PASS; asset identity/crop/anchor/layering PASS; controls PASS; overflow PASS; scroll top PASS.

- [Mock](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v7/vertigo_glass/mock/1280x678-player-compact-top.png)
- [Docker](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/actual/1280x678-player-compact-top.png)
- [Side-by-side](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1280x678-player-compact-top-side.png)
- [Overlay](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1280x678-player-compact-top-overlay.png)
- [Diff](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1280x678-player-compact-top-diff.png)

### 1280x678-player-compact-viewport.png - PASS

Chrome PASS; heights/first viewport PASS; typography PASS; background PASS; asset identity/crop/anchor/layering PASS; controls PASS; overflow PASS; scroll viewport PASS.

- [Mock](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v7/vertigo_glass/mock/1280x678-player-compact-viewport.png)
- [Docker](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/actual/1280x678-player-compact-viewport.png)
- [Side-by-side](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1280x678-player-compact-viewport-side.png)
- [Overlay](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1280x678-player-compact-viewport-overlay.png)
- [Diff](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1280x678-player-compact-viewport-diff.png)

### 1280x678-player-compact-bottom.png - PASS

Chrome PASS; heights/first viewport PASS; typography PASS; background PASS; asset identity/crop/anchor/layering PASS; controls PASS; overflow PASS; scroll bottom PASS.

- [Mock](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v7/vertigo_glass/mock/1280x678-player-compact-bottom.png)
- [Docker](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/actual/1280x678-player-compact-bottom.png)
- [Side-by-side](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1280x678-player-compact-bottom-side.png)
- [Overlay](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1280x678-player-compact-bottom-overlay.png)
- [Diff](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1280x678-player-compact-bottom-diff.png)

### 1280x678-player-expanded-top.png - PASS

Chrome PASS; heights/first viewport PASS; typography PASS; background PASS; asset identity/crop/anchor/layering PASS; controls PASS; overflow PASS; scroll top PASS.

- [Mock](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v9/vertigo_glass/mock/1280x678-player-expanded-top.png)
- [Docker](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/actual/1280x678-player-expanded-top.png)
- [Side-by-side](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1280x678-player-expanded-top-side.png)
- [Overlay](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1280x678-player-expanded-top-overlay.png)
- [Diff](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1280x678-player-expanded-top-diff.png)

### 1280x678-player-expanded-viewport.png - PASS

Chrome PASS; heights/first viewport PASS; typography PASS; background PASS; asset identity/crop/anchor/layering PASS; controls PASS; overflow PASS; scroll viewport PASS.

- [Mock](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v9/vertigo_glass/mock/1280x678-player-expanded-viewport.png)
- [Docker](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/actual/1280x678-player-expanded-viewport.png)
- [Side-by-side](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1280x678-player-expanded-viewport-side.png)
- [Overlay](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1280x678-player-expanded-viewport-overlay.png)
- [Diff](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1280x678-player-expanded-viewport-diff.png)

### 1280x678-player-expanded-bottom.png - PASS

Chrome PASS; heights/first viewport PASS; typography PASS; background PASS; asset identity/crop/anchor/layering PASS; controls PASS; overflow PASS; scroll bottom PASS.

- [Mock](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v9/vertigo_glass/mock/1280x678-player-expanded-bottom.png)
- [Docker](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/actual/1280x678-player-expanded-bottom.png)
- [Side-by-side](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1280x678-player-expanded-bottom-side.png)
- [Overlay](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1280x678-player-expanded-bottom-overlay.png)
- [Diff](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1280x678-player-expanded-bottom-diff.png)

### 1024x678-place-top.png - PASS

Chrome PASS; heights/first viewport PASS; typography PASS; background PASS; asset identity/crop/anchor/layering PASS; controls PASS; overflow PASS; scroll top PASS.

- [Mock](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v7/vertigo_glass/mock/1024x678-place-top.png)
- [Docker](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/actual/1024x678-place-top.png)
- [Side-by-side](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1024x678-place-top-side.png)
- [Overlay](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1024x678-place-top-overlay.png)
- [Diff](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1024x678-place-top-diff.png)

### 1024x678-place-viewport.png - PASS

Chrome PASS; heights/first viewport PASS; typography PASS; background PASS; asset identity/crop/anchor/layering PASS; controls PASS; overflow PASS; scroll viewport PASS.

- [Mock](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v7/vertigo_glass/mock/1024x678-place-viewport.png)
- [Docker](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/actual/1024x678-place-viewport.png)
- [Side-by-side](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1024x678-place-viewport-side.png)
- [Overlay](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1024x678-place-viewport-overlay.png)
- [Diff](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1024x678-place-viewport-diff.png)

### 1024x678-place-bottom.png - PASS

Chrome PASS; heights/first viewport PASS; typography PASS; background PASS; asset identity/crop/anchor/layering PASS; controls PASS; overflow PASS; scroll bottom PASS.

- [Mock](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v7/vertigo_glass/mock/1024x678-place-bottom.png)
- [Docker](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/actual/1024x678-place-bottom.png)
- [Side-by-side](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1024x678-place-bottom-side.png)
- [Overlay](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1024x678-place-bottom-overlay.png)
- [Diff](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1024x678-place-bottom-diff.png)

### 1024x678-answered-top.png - PASS

Chrome PASS; heights/first viewport PASS; typography PASS; background PASS; asset identity/crop/anchor/layering PASS; controls PASS; overflow PASS; scroll top PASS.

- [Mock](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v7/vertigo_glass/mock/1024x678-answered-top.png)
- [Docker](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/actual/1024x678-answered-top.png)
- [Side-by-side](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1024x678-answered-top-side.png)
- [Overlay](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1024x678-answered-top-overlay.png)
- [Diff](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1024x678-answered-top-diff.png)

### 1024x678-answered-viewport.png - PASS

Chrome PASS; heights/first viewport PASS; typography PASS; background PASS; asset identity/crop/anchor/layering PASS; controls PASS; overflow PASS; scroll viewport PASS.

- [Mock](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v7/vertigo_glass/mock/1024x678-answered-viewport.png)
- [Docker](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/actual/1024x678-answered-viewport.png)
- [Side-by-side](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1024x678-answered-viewport-side.png)
- [Overlay](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1024x678-answered-viewport-overlay.png)
- [Diff](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1024x678-answered-viewport-diff.png)

### 1024x678-answered-bottom.png - PASS

Chrome PASS; heights/first viewport PASS; typography PASS; background PASS; asset identity/crop/anchor/layering PASS; controls PASS; overflow PASS; scroll bottom PASS.

- [Mock](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v7/vertigo_glass/mock/1024x678-answered-bottom.png)
- [Docker](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/actual/1024x678-answered-bottom.png)
- [Side-by-side](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1024x678-answered-bottom-side.png)
- [Overlay](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1024x678-answered-bottom-overlay.png)
- [Diff](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1024x678-answered-bottom-diff.png)

### 1024x678-answered-expanded-top.png - PASS

Chrome PASS; heights/first viewport PASS; typography PASS; background PASS; asset identity/crop/anchor/layering PASS; controls PASS; overflow PASS; scroll top PASS.

- [Mock](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v7/vertigo_glass/mock/1024x678-answered-expanded-top.png)
- [Docker](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/actual/1024x678-answered-expanded-top.png)
- [Side-by-side](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1024x678-answered-expanded-top-side.png)
- [Overlay](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1024x678-answered-expanded-top-overlay.png)
- [Diff](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1024x678-answered-expanded-top-diff.png)

### 1024x678-answered-expanded-viewport.png - PASS

Chrome PASS; heights/first viewport PASS; typography PASS; background PASS; asset identity/crop/anchor/layering PASS; controls PASS; overflow PASS; scroll viewport PASS.

- [Mock](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v7/vertigo_glass/mock/1024x678-answered-expanded-viewport.png)
- [Docker](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/actual/1024x678-answered-expanded-viewport.png)
- [Side-by-side](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1024x678-answered-expanded-viewport-side.png)
- [Overlay](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1024x678-answered-expanded-viewport-overlay.png)
- [Diff](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1024x678-answered-expanded-viewport-diff.png)

### 1024x678-answered-expanded-bottom.png - PASS

Chrome PASS; heights/first viewport PASS; typography PASS; background PASS; asset identity/crop/anchor/layering PASS; controls PASS; overflow PASS; scroll bottom PASS.

- [Mock](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v7/vertigo_glass/mock/1024x678-answered-expanded-bottom.png)
- [Docker](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/actual/1024x678-answered-expanded-bottom.png)
- [Side-by-side](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1024x678-answered-expanded-bottom-side.png)
- [Overlay](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1024x678-answered-expanded-bottom-overlay.png)
- [Diff](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1024x678-answered-expanded-bottom-diff.png)

### 1024x678-player-compact-top.png - PASS

Chrome PASS; heights/first viewport PASS; typography PASS; background PASS; asset identity/crop/anchor/layering PASS; controls PASS; overflow PASS; scroll top PASS.

- [Mock](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v7/vertigo_glass/mock/1024x678-player-compact-top.png)
- [Docker](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/actual/1024x678-player-compact-top.png)
- [Side-by-side](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1024x678-player-compact-top-side.png)
- [Overlay](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1024x678-player-compact-top-overlay.png)
- [Diff](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1024x678-player-compact-top-diff.png)

### 1024x678-player-compact-viewport.png - PASS

Chrome PASS; heights/first viewport PASS; typography PASS; background PASS; asset identity/crop/anchor/layering PASS; controls PASS; overflow PASS; scroll viewport PASS.

- [Mock](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v7/vertigo_glass/mock/1024x678-player-compact-viewport.png)
- [Docker](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/actual/1024x678-player-compact-viewport.png)
- [Side-by-side](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1024x678-player-compact-viewport-side.png)
- [Overlay](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1024x678-player-compact-viewport-overlay.png)
- [Diff](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1024x678-player-compact-viewport-diff.png)

### 1024x678-player-compact-bottom.png - PASS

Chrome PASS; heights/first viewport PASS; typography PASS; background PASS; asset identity/crop/anchor/layering PASS; controls PASS; overflow PASS; scroll bottom PASS.

- [Mock](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v7/vertigo_glass/mock/1024x678-player-compact-bottom.png)
- [Docker](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/actual/1024x678-player-compact-bottom.png)
- [Side-by-side](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1024x678-player-compact-bottom-side.png)
- [Overlay](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1024x678-player-compact-bottom-overlay.png)
- [Diff](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1024x678-player-compact-bottom-diff.png)

### 1024x678-player-expanded-top.png - PASS

Chrome PASS; heights/first viewport PASS; typography PASS; background PASS; asset identity/crop/anchor/layering PASS; controls PASS; overflow PASS; scroll top PASS.

- [Mock](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v9/vertigo_glass/mock/1024x678-player-expanded-top.png)
- [Docker](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/actual/1024x678-player-expanded-top.png)
- [Side-by-side](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1024x678-player-expanded-top-side.png)
- [Overlay](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1024x678-player-expanded-top-overlay.png)
- [Diff](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1024x678-player-expanded-top-diff.png)

### 1024x678-player-expanded-viewport.png - PASS

Chrome PASS; heights/first viewport PASS; typography PASS; background PASS; asset identity/crop/anchor/layering PASS; controls PASS; overflow PASS; scroll viewport PASS.

- [Mock](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v9/vertigo_glass/mock/1024x678-player-expanded-viewport.png)
- [Docker](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/actual/1024x678-player-expanded-viewport.png)
- [Side-by-side](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1024x678-player-expanded-viewport-side.png)
- [Overlay](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1024x678-player-expanded-viewport-overlay.png)
- [Diff](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1024x678-player-expanded-viewport-diff.png)

### 1024x678-player-expanded-bottom.png - PASS

Chrome PASS; heights/first viewport PASS; typography PASS; background PASS; asset identity/crop/anchor/layering PASS; controls PASS; overflow PASS; scroll bottom PASS.

- [Mock](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v9/vertigo_glass/mock/1024x678-player-expanded-bottom.png)
- [Docker](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/actual/1024x678-player-expanded-bottom.png)
- [Side-by-side](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1024x678-player-expanded-bottom-side.png)
- [Overlay](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1024x678-player-expanded-bottom-overlay.png)
- [Diff](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/1024x678-player-expanded-bottom-diff.png)

### 768x1024-place-top.png - PASS

Chrome PASS; heights/first viewport PASS; typography PASS; background PASS; asset identity/crop/anchor/layering PASS; controls PASS; overflow PASS; scroll top PASS.

- [Mock](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v7/vertigo_glass/stable-reference/mock/768x1024-place-top.png)
- [Docker](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/actual/768x1024-place-top.png)
- [Side-by-side](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/768x1024-place-top-side.png)
- [Overlay](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/768x1024-place-top-overlay.png)
- [Diff](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/768x1024-place-top-diff.png)

### 768x1024-place-viewport.png - PASS

Chrome PASS; heights/first viewport PASS; typography PASS; background PASS; asset identity/crop/anchor/layering PASS; controls PASS; overflow PASS; scroll viewport PASS.

- [Mock](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v7/vertigo_glass/stable-reference/mock/768x1024-place-viewport.png)
- [Docker](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/actual/768x1024-place-viewport.png)
- [Side-by-side](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/768x1024-place-viewport-side.png)
- [Overlay](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/768x1024-place-viewport-overlay.png)
- [Diff](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/768x1024-place-viewport-diff.png)

### 768x1024-place-bottom.png - PASS

Chrome PASS; heights/first viewport PASS; typography PASS; background PASS; asset identity/crop/anchor/layering PASS; controls PASS; overflow PASS; scroll bottom PASS.

- [Mock](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v7/vertigo_glass/stable-reference/mock/768x1024-place-bottom.png)
- [Docker](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/actual/768x1024-place-bottom.png)
- [Side-by-side](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/768x1024-place-bottom-side.png)
- [Overlay](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/768x1024-place-bottom-overlay.png)
- [Diff](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/768x1024-place-bottom-diff.png)

### 768x1024-answered-top.png - PASS

Chrome PASS; heights/first viewport PASS; typography PASS; background PASS; asset identity/crop/anchor/layering PASS; controls PASS; overflow PASS; scroll top PASS.

- [Mock](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v7/vertigo_glass/stable-reference/mock/768x1024-answered-top.png)
- [Docker](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/actual/768x1024-answered-top.png)
- [Side-by-side](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/768x1024-answered-top-side.png)
- [Overlay](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/768x1024-answered-top-overlay.png)
- [Diff](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/768x1024-answered-top-diff.png)

### 768x1024-answered-viewport.png - PASS

Chrome PASS; heights/first viewport PASS; typography PASS; background PASS; asset identity/crop/anchor/layering PASS; controls PASS; overflow PASS; scroll viewport PASS.

- [Mock](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v7/vertigo_glass/stable-reference/mock/768x1024-answered-viewport.png)
- [Docker](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/actual/768x1024-answered-viewport.png)
- [Side-by-side](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/768x1024-answered-viewport-side.png)
- [Overlay](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/768x1024-answered-viewport-overlay.png)
- [Diff](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/768x1024-answered-viewport-diff.png)

### 768x1024-answered-bottom.png - PASS

Chrome PASS; heights/first viewport PASS; typography PASS; background PASS; asset identity/crop/anchor/layering PASS; controls PASS; overflow PASS; scroll bottom PASS.

- [Mock](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v7/vertigo_glass/stable-reference/mock/768x1024-answered-bottom.png)
- [Docker](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/actual/768x1024-answered-bottom.png)
- [Side-by-side](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/768x1024-answered-bottom-side.png)
- [Overlay](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/768x1024-answered-bottom-overlay.png)
- [Diff](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/768x1024-answered-bottom-diff.png)

### 768x1024-answered-expanded-top.png - PASS

Chrome PASS; heights/first viewport PASS; typography PASS; background PASS; asset identity/crop/anchor/layering PASS; controls PASS; overflow PASS; scroll top PASS.

- [Mock](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v7/vertigo_glass/stable-reference/mock/768x1024-answered-expanded-top.png)
- [Docker](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/actual/768x1024-answered-expanded-top.png)
- [Side-by-side](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/768x1024-answered-expanded-top-side.png)
- [Overlay](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/768x1024-answered-expanded-top-overlay.png)
- [Diff](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/768x1024-answered-expanded-top-diff.png)

### 768x1024-answered-expanded-viewport.png - PASS

Chrome PASS; heights/first viewport PASS; typography PASS; background PASS; asset identity/crop/anchor/layering PASS; controls PASS; overflow PASS; scroll viewport PASS.

- [Mock](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v7/vertigo_glass/stable-reference/mock/768x1024-answered-expanded-viewport.png)
- [Docker](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/actual/768x1024-answered-expanded-viewport.png)
- [Side-by-side](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/768x1024-answered-expanded-viewport-side.png)
- [Overlay](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/768x1024-answered-expanded-viewport-overlay.png)
- [Diff](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/768x1024-answered-expanded-viewport-diff.png)

### 768x1024-answered-expanded-bottom.png - PASS

Chrome PASS; heights/first viewport PASS; typography PASS; background PASS; asset identity/crop/anchor/layering PASS; controls PASS; overflow PASS; scroll bottom PASS.

- [Mock](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v7/vertigo_glass/stable-reference/mock/768x1024-answered-expanded-bottom.png)
- [Docker](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/actual/768x1024-answered-expanded-bottom.png)
- [Side-by-side](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/768x1024-answered-expanded-bottom-side.png)
- [Overlay](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/768x1024-answered-expanded-bottom-overlay.png)
- [Diff](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/768x1024-answered-expanded-bottom-diff.png)

### 768x1024-player-compact-top.png - PASS

Chrome PASS; heights/first viewport PASS; typography PASS; background PASS; asset identity/crop/anchor/layering PASS; controls PASS; overflow PASS; scroll top PASS.

- [Mock](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v7/vertigo_glass/stable-reference/mock/768x1024-player-compact-top.png)
- [Docker](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/actual/768x1024-player-compact-top.png)
- [Side-by-side](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/768x1024-player-compact-top-side.png)
- [Overlay](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/768x1024-player-compact-top-overlay.png)
- [Diff](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/768x1024-player-compact-top-diff.png)

### 768x1024-player-compact-viewport.png - PASS

Chrome PASS; heights/first viewport PASS; typography PASS; background PASS; asset identity/crop/anchor/layering PASS; controls PASS; overflow PASS; scroll viewport PASS.

- [Mock](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v7/vertigo_glass/stable-reference/mock/768x1024-player-compact-viewport.png)
- [Docker](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/actual/768x1024-player-compact-viewport.png)
- [Side-by-side](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/768x1024-player-compact-viewport-side.png)
- [Overlay](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/768x1024-player-compact-viewport-overlay.png)
- [Diff](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/768x1024-player-compact-viewport-diff.png)

### 768x1024-player-compact-bottom.png - PASS

Chrome PASS; heights/first viewport PASS; typography PASS; background PASS; asset identity/crop/anchor/layering PASS; controls PASS; overflow PASS; scroll bottom PASS.

- [Mock](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v7/vertigo_glass/stable-reference/mock/768x1024-player-compact-bottom.png)
- [Docker](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/actual/768x1024-player-compact-bottom.png)
- [Side-by-side](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/768x1024-player-compact-bottom-side.png)
- [Overlay](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/768x1024-player-compact-bottom-overlay.png)
- [Diff](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/768x1024-player-compact-bottom-diff.png)

### 768x1024-player-expanded-top.png - PASS

Chrome PASS; heights/first viewport PASS; typography PASS; background PASS; asset identity/crop/anchor/layering PASS; controls PASS; overflow PASS; scroll top PASS.

- [Mock](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v9/vertigo_glass/mock/768x1024-player-expanded-top.png)
- [Docker](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/actual/768x1024-player-expanded-top.png)
- [Side-by-side](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/768x1024-player-expanded-top-side.png)
- [Overlay](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/768x1024-player-expanded-top-overlay.png)
- [Diff](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/768x1024-player-expanded-top-diff.png)

### 768x1024-player-expanded-viewport.png - PASS

Chrome PASS; heights/first viewport PASS; typography PASS; background PASS; asset identity/crop/anchor/layering PASS; controls PASS; overflow PASS; scroll viewport PASS.

- [Mock](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v9/vertigo_glass/mock/768x1024-player-expanded-viewport.png)
- [Docker](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/actual/768x1024-player-expanded-viewport.png)
- [Side-by-side](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/768x1024-player-expanded-viewport-side.png)
- [Overlay](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/768x1024-player-expanded-viewport-overlay.png)
- [Diff](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/768x1024-player-expanded-viewport-diff.png)

### 768x1024-player-expanded-bottom.png - PASS

Chrome PASS; heights/first viewport PASS; typography PASS; background PASS; asset identity/crop/anchor/layering PASS; controls PASS; overflow PASS; scroll bottom PASS.

- [Mock](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v9/vertigo_glass/mock/768x1024-player-expanded-bottom.png)
- [Docker](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/actual/768x1024-player-expanded-bottom.png)
- [Side-by-side](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/768x1024-player-expanded-bottom-side.png)
- [Overlay](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/768x1024-player-expanded-bottom-overlay.png)
- [Diff](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/768x1024-player-expanded-bottom-diff.png)

### 390x844-place-top.png - PASS

Chrome PASS; heights/first viewport PASS; typography PASS; background PASS; asset identity/crop/anchor/layering PASS; controls PASS; overflow PASS; scroll top PASS.

- [Mock](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v7/vertigo_glass/mock/390x844-place-top.png)
- [Docker](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/actual/390x844-place-top.png)
- [Side-by-side](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/390x844-place-top-side.png)
- [Overlay](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/390x844-place-top-overlay.png)
- [Diff](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/390x844-place-top-diff.png)

### 390x844-place-viewport.png - PASS

Chrome PASS; heights/first viewport PASS; typography PASS; background PASS; asset identity/crop/anchor/layering PASS; controls PASS; overflow PASS; scroll viewport PASS.

- [Mock](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v7/vertigo_glass/mock/390x844-place-viewport.png)
- [Docker](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/actual/390x844-place-viewport.png)
- [Side-by-side](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/390x844-place-viewport-side.png)
- [Overlay](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/390x844-place-viewport-overlay.png)
- [Diff](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/390x844-place-viewport-diff.png)

### 390x844-place-bottom.png - PASS

Chrome PASS; heights/first viewport PASS; typography PASS; background PASS; asset identity/crop/anchor/layering PASS; controls PASS; overflow PASS; scroll bottom PASS.

- [Mock](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v7/vertigo_glass/mock/390x844-place-bottom.png)
- [Docker](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/actual/390x844-place-bottom.png)
- [Side-by-side](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/390x844-place-bottom-side.png)
- [Overlay](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/390x844-place-bottom-overlay.png)
- [Diff](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/390x844-place-bottom-diff.png)

### 390x844-answered-top.png - PASS

Chrome PASS; heights/first viewport PASS; typography PASS; background PASS; asset identity/crop/anchor/layering PASS; controls PASS; overflow PASS; scroll top PASS.

- [Mock](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v7/vertigo_glass/mock/390x844-answered-top.png)
- [Docker](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/actual/390x844-answered-top.png)
- [Side-by-side](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/390x844-answered-top-side.png)
- [Overlay](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/390x844-answered-top-overlay.png)
- [Diff](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/390x844-answered-top-diff.png)

### 390x844-answered-viewport.png - PASS

Chrome PASS; heights/first viewport PASS; typography PASS; background PASS; asset identity/crop/anchor/layering PASS; controls PASS; overflow PASS; scroll viewport PASS.

- [Mock](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v7/vertigo_glass/mock/390x844-answered-viewport.png)
- [Docker](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/actual/390x844-answered-viewport.png)
- [Side-by-side](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/390x844-answered-viewport-side.png)
- [Overlay](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/390x844-answered-viewport-overlay.png)
- [Diff](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/390x844-answered-viewport-diff.png)

### 390x844-answered-bottom.png - PASS

Chrome PASS; heights/first viewport PASS; typography PASS; background PASS; asset identity/crop/anchor/layering PASS; controls PASS; overflow PASS; scroll bottom PASS.

- [Mock](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v7/vertigo_glass/mock/390x844-answered-bottom.png)
- [Docker](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/actual/390x844-answered-bottom.png)
- [Side-by-side](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/390x844-answered-bottom-side.png)
- [Overlay](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/390x844-answered-bottom-overlay.png)
- [Diff](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/390x844-answered-bottom-diff.png)

### 390x844-answered-expanded-top.png - PASS

Chrome PASS; heights/first viewport PASS; typography PASS; background PASS; asset identity/crop/anchor/layering PASS; controls PASS; overflow PASS; scroll top PASS.

- [Mock](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v7/vertigo_glass/mock/390x844-answered-expanded-top.png)
- [Docker](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/actual/390x844-answered-expanded-top.png)
- [Side-by-side](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/390x844-answered-expanded-top-side.png)
- [Overlay](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/390x844-answered-expanded-top-overlay.png)
- [Diff](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/390x844-answered-expanded-top-diff.png)

### 390x844-answered-expanded-viewport.png - PASS

Chrome PASS; heights/first viewport PASS; typography PASS; background PASS; asset identity/crop/anchor/layering PASS; controls PASS; overflow PASS; scroll viewport PASS.

- [Mock](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v7/vertigo_glass/mock/390x844-answered-expanded-viewport.png)
- [Docker](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/actual/390x844-answered-expanded-viewport.png)
- [Side-by-side](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/390x844-answered-expanded-viewport-side.png)
- [Overlay](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/390x844-answered-expanded-viewport-overlay.png)
- [Diff](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/390x844-answered-expanded-viewport-diff.png)

### 390x844-answered-expanded-bottom.png - PASS

Chrome PASS; heights/first viewport PASS; typography PASS; background PASS; asset identity/crop/anchor/layering PASS; controls PASS; overflow PASS; scroll bottom PASS.

- [Mock](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v7/vertigo_glass/mock/390x844-answered-expanded-bottom.png)
- [Docker](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/actual/390x844-answered-expanded-bottom.png)
- [Side-by-side](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/390x844-answered-expanded-bottom-side.png)
- [Overlay](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/390x844-answered-expanded-bottom-overlay.png)
- [Diff](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/390x844-answered-expanded-bottom-diff.png)

### 844x390-place-top.png - PASS

Chrome PASS; heights/first viewport PASS; typography PASS; background PASS; asset identity/crop/anchor/layering PASS; controls PASS; overflow PASS; scroll top PASS.

- [Mock](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v9/vertigo_glass/mock/844x390-place-top.png)
- [Docker](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/actual/844x390-place-top.png)
- [Side-by-side](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/844x390-place-top-side.png)
- [Overlay](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/844x390-place-top-overlay.png)
- [Diff](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/844x390-place-top-diff.png)

### 844x390-place-viewport.png - PASS

Chrome PASS; heights/first viewport PASS; typography PASS; background PASS; asset identity/crop/anchor/layering PASS; controls PASS; overflow PASS; scroll viewport PASS.

- [Mock](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v9/vertigo_glass/mock/844x390-place-viewport.png)
- [Docker](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/actual/844x390-place-viewport.png)
- [Side-by-side](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/844x390-place-viewport-side.png)
- [Overlay](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/844x390-place-viewport-overlay.png)
- [Diff](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/844x390-place-viewport-diff.png)

### 844x390-place-bottom.png - PASS

Chrome PASS; heights/first viewport PASS; typography PASS; background PASS; asset identity/crop/anchor/layering PASS; controls PASS; overflow PASS; scroll bottom PASS.

- [Mock](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v9/vertigo_glass/mock/844x390-place-bottom.png)
- [Docker](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/actual/844x390-place-bottom.png)
- [Side-by-side](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/844x390-place-bottom-side.png)
- [Overlay](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/844x390-place-bottom-overlay.png)
- [Diff](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/844x390-place-bottom-diff.png)

### 844x390-answered-top.png - PASS

Chrome PASS; heights/first viewport PASS; typography PASS; background PASS; asset identity/crop/anchor/layering PASS; controls PASS; overflow PASS; scroll top PASS.

- [Mock](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v9/vertigo_glass/mock/844x390-answered-top.png)
- [Docker](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/actual/844x390-answered-top.png)
- [Side-by-side](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/844x390-answered-top-side.png)
- [Overlay](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/844x390-answered-top-overlay.png)
- [Diff](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/844x390-answered-top-diff.png)

### 844x390-answered-viewport.png - PASS

Chrome PASS; heights/first viewport PASS; typography PASS; background PASS; asset identity/crop/anchor/layering PASS; controls PASS; overflow PASS; scroll viewport PASS.

- [Mock](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v9/vertigo_glass/mock/844x390-answered-viewport.png)
- [Docker](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/actual/844x390-answered-viewport.png)
- [Side-by-side](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/844x390-answered-viewport-side.png)
- [Overlay](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/844x390-answered-viewport-overlay.png)
- [Diff](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/844x390-answered-viewport-diff.png)

### 844x390-answered-bottom.png - PASS

Chrome PASS; heights/first viewport PASS; typography PASS; background PASS; asset identity/crop/anchor/layering PASS; controls PASS; overflow PASS; scroll bottom PASS.

- [Mock](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v9/vertigo_glass/mock/844x390-answered-bottom.png)
- [Docker](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/actual/844x390-answered-bottom.png)
- [Side-by-side](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/844x390-answered-bottom-side.png)
- [Overlay](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/844x390-answered-bottom-overlay.png)
- [Diff](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/844x390-answered-bottom-diff.png)

### 844x390-answered-expanded-top.png - PASS

Chrome PASS; heights/first viewport PASS; typography PASS; background PASS; asset identity/crop/anchor/layering PASS; controls PASS; overflow PASS; scroll top PASS.

- [Mock](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v9/vertigo_glass/mock/844x390-answered-expanded-top.png)
- [Docker](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/actual/844x390-answered-expanded-top.png)
- [Side-by-side](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/844x390-answered-expanded-top-side.png)
- [Overlay](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/844x390-answered-expanded-top-overlay.png)
- [Diff](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/844x390-answered-expanded-top-diff.png)

### 844x390-answered-expanded-viewport.png - PASS

Chrome PASS; heights/first viewport PASS; typography PASS; background PASS; asset identity/crop/anchor/layering PASS; controls PASS; overflow PASS; scroll viewport PASS.

- [Mock](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v9/vertigo_glass/mock/844x390-answered-expanded-viewport.png)
- [Docker](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/actual/844x390-answered-expanded-viewport.png)
- [Side-by-side](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/844x390-answered-expanded-viewport-side.png)
- [Overlay](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/844x390-answered-expanded-viewport-overlay.png)
- [Diff](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/844x390-answered-expanded-viewport-diff.png)

### 844x390-answered-expanded-bottom.png - PASS

Chrome PASS; heights/first viewport PASS; typography PASS; background PASS; asset identity/crop/anchor/layering PASS; controls PASS; overflow PASS; scroll bottom PASS.

- [Mock](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v9/vertigo_glass/mock/844x390-answered-expanded-bottom.png)
- [Docker](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/actual/844x390-answered-expanded-bottom.png)
- [Side-by-side](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/844x390-answered-expanded-bottom-side.png)
- [Overlay](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/844x390-answered-expanded-bottom-overlay.png)
- [Diff](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/844x390-answered-expanded-bottom-diff.png)

### 844x390-player-compact-top.png - PASS

Chrome PASS; heights/first viewport PASS; typography PASS; background PASS; asset identity/crop/anchor/layering PASS; controls PASS; overflow PASS; scroll top PASS.

- [Mock](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v9/vertigo_glass/mock/844x390-player-compact-top.png)
- [Docker](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/actual/844x390-player-compact-top.png)
- [Side-by-side](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/844x390-player-compact-top-side.png)
- [Overlay](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/844x390-player-compact-top-overlay.png)
- [Diff](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/844x390-player-compact-top-diff.png)

### 844x390-player-compact-viewport.png - PASS

Chrome PASS; heights/first viewport PASS; typography PASS; background PASS; asset identity/crop/anchor/layering PASS; controls PASS; overflow PASS; scroll viewport PASS.

- [Mock](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v9/vertigo_glass/mock/844x390-player-compact-viewport.png)
- [Docker](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/actual/844x390-player-compact-viewport.png)
- [Side-by-side](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/844x390-player-compact-viewport-side.png)
- [Overlay](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/844x390-player-compact-viewport-overlay.png)
- [Diff](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/844x390-player-compact-viewport-diff.png)

### 844x390-player-compact-bottom.png - PASS

Chrome PASS; heights/first viewport PASS; typography PASS; background PASS; asset identity/crop/anchor/layering PASS; controls PASS; overflow PASS; scroll bottom PASS.

- [Mock](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v9/vertigo_glass/mock/844x390-player-compact-bottom.png)
- [Docker](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/actual/844x390-player-compact-bottom.png)
- [Side-by-side](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/844x390-player-compact-bottom-side.png)
- [Overlay](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/844x390-player-compact-bottom-overlay.png)
- [Diff](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/844x390-player-compact-bottom-diff.png)

### 390x544-place-top.png - PASS

Chrome PASS; heights/first viewport PASS; typography PASS; background PASS; asset identity/crop/anchor/layering PASS; controls PASS; overflow PASS; scroll top PASS.

- [Mock](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v7/vertigo_glass/mock/390x544-place-top.png)
- [Docker](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/actual/390x544-place-top.png)
- [Side-by-side](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/390x544-place-top-side.png)
- [Overlay](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/390x544-place-top-overlay.png)
- [Diff](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/390x544-place-top-diff.png)

### 390x544-place-viewport.png - PASS

Chrome PASS; heights/first viewport PASS; typography PASS; background PASS; asset identity/crop/anchor/layering PASS; controls PASS; overflow PASS; scroll viewport PASS.

- [Mock](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v7/vertigo_glass/mock/390x544-place-viewport.png)
- [Docker](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/actual/390x544-place-viewport.png)
- [Side-by-side](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/390x544-place-viewport-side.png)
- [Overlay](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/390x544-place-viewport-overlay.png)
- [Diff](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/390x544-place-viewport-diff.png)

### 390x544-place-bottom.png - PASS

Chrome PASS; heights/first viewport PASS; typography PASS; background PASS; asset identity/crop/anchor/layering PASS; controls PASS; overflow PASS; scroll bottom PASS.

- [Mock](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v7/vertigo_glass/mock/390x544-place-bottom.png)
- [Docker](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/actual/390x544-place-bottom.png)
- [Side-by-side](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/390x544-place-bottom-side.png)
- [Overlay](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/390x544-place-bottom-overlay.png)
- [Diff](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/390x544-place-bottom-diff.png)

### 390x544-answered-top.png - PASS

Chrome PASS; heights/first viewport PASS; typography PASS; background PASS; asset identity/crop/anchor/layering PASS; controls PASS; overflow PASS; scroll top PASS.

- [Mock](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v7/vertigo_glass/mock/390x544-answered-top.png)
- [Docker](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/actual/390x544-answered-top.png)
- [Side-by-side](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/390x544-answered-top-side.png)
- [Overlay](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/390x544-answered-top-overlay.png)
- [Diff](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/390x544-answered-top-diff.png)

### 390x544-answered-viewport.png - PASS

Chrome PASS; heights/first viewport PASS; typography PASS; background PASS; asset identity/crop/anchor/layering PASS; controls PASS; overflow PASS; scroll viewport PASS.

- [Mock](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v7/vertigo_glass/mock/390x544-answered-viewport.png)
- [Docker](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/actual/390x544-answered-viewport.png)
- [Side-by-side](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/390x544-answered-viewport-side.png)
- [Overlay](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/390x544-answered-viewport-overlay.png)
- [Diff](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/390x544-answered-viewport-diff.png)

### 390x544-answered-bottom.png - PASS

Chrome PASS; heights/first viewport PASS; typography PASS; background PASS; asset identity/crop/anchor/layering PASS; controls PASS; overflow PASS; scroll bottom PASS.

- [Mock](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v7/vertigo_glass/mock/390x544-answered-bottom.png)
- [Docker](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/actual/390x544-answered-bottom.png)
- [Side-by-side](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/390x544-answered-bottom-side.png)
- [Overlay](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/390x544-answered-bottom-overlay.png)
- [Diff](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/390x544-answered-bottom-diff.png)

### 390x544-answered-expanded-top.png - PASS

Chrome PASS; heights/first viewport PASS; typography PASS; background PASS; asset identity/crop/anchor/layering PASS; controls PASS; overflow PASS; scroll top PASS.

- [Mock](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v7/vertigo_glass/mock/390x544-answered-expanded-top.png)
- [Docker](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/actual/390x544-answered-expanded-top.png)
- [Side-by-side](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/390x544-answered-expanded-top-side.png)
- [Overlay](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/390x544-answered-expanded-top-overlay.png)
- [Diff](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/390x544-answered-expanded-top-diff.png)

### 390x544-answered-expanded-viewport.png - PASS

Chrome PASS; heights/first viewport PASS; typography PASS; background PASS; asset identity/crop/anchor/layering PASS; controls PASS; overflow PASS; scroll viewport PASS.

- [Mock](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v7/vertigo_glass/mock/390x544-answered-expanded-viewport.png)
- [Docker](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/actual/390x544-answered-expanded-viewport.png)
- [Side-by-side](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/390x544-answered-expanded-viewport-side.png)
- [Overlay](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/390x544-answered-expanded-viewport-overlay.png)
- [Diff](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/390x544-answered-expanded-viewport-diff.png)

### 390x544-answered-expanded-bottom.png - PASS

Chrome PASS; heights/first viewport PASS; typography PASS; background PASS; asset identity/crop/anchor/layering PASS; controls PASS; overflow PASS; scroll bottom PASS.

- [Mock](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v7/vertigo_glass/mock/390x544-answered-expanded-bottom.png)
- [Docker](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/actual/390x544-answered-expanded-bottom.png)
- [Side-by-side](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/390x544-answered-expanded-bottom-side.png)
- [Overlay](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/390x544-answered-expanded-bottom-overlay.png)
- [Diff](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/390x544-answered-expanded-bottom-diff.png)

### 320x740-place-top.png - PASS

Chrome PASS; heights/first viewport PASS; typography PASS; background PASS; asset identity/crop/anchor/layering PASS; controls PASS; overflow PASS; scroll top PASS.

- [Mock](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v7/vertigo_glass/mock/320x740-place-top.png)
- [Docker](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/actual/320x740-place-top.png)
- [Side-by-side](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/320x740-place-top-side.png)
- [Overlay](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/320x740-place-top-overlay.png)
- [Diff](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/320x740-place-top-diff.png)

### 320x740-place-viewport.png - PASS

Chrome PASS; heights/first viewport PASS; typography PASS; background PASS; asset identity/crop/anchor/layering PASS; controls PASS; overflow PASS; scroll viewport PASS.

- [Mock](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v7/vertigo_glass/mock/320x740-place-viewport.png)
- [Docker](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/actual/320x740-place-viewport.png)
- [Side-by-side](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/320x740-place-viewport-side.png)
- [Overlay](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/320x740-place-viewport-overlay.png)
- [Diff](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/320x740-place-viewport-diff.png)

### 320x740-place-bottom.png - PASS

Chrome PASS; heights/first viewport PASS; typography PASS; background PASS; asset identity/crop/anchor/layering PASS; controls PASS; overflow PASS; scroll bottom PASS.

- [Mock](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v7/vertigo_glass/mock/320x740-place-bottom.png)
- [Docker](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/actual/320x740-place-bottom.png)
- [Side-by-side](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/320x740-place-bottom-side.png)
- [Overlay](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/320x740-place-bottom-overlay.png)
- [Diff](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/320x740-place-bottom-diff.png)

### 320x740-answered-top.png - PASS

Chrome PASS; heights/first viewport PASS; typography PASS; background PASS; asset identity/crop/anchor/layering PASS; controls PASS; overflow PASS; scroll top PASS.

- [Mock](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v7/vertigo_glass/mock/320x740-answered-top.png)
- [Docker](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/actual/320x740-answered-top.png)
- [Side-by-side](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/320x740-answered-top-side.png)
- [Overlay](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/320x740-answered-top-overlay.png)
- [Diff](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/320x740-answered-top-diff.png)

### 320x740-answered-viewport.png - PASS

Chrome PASS; heights/first viewport PASS; typography PASS; background PASS; asset identity/crop/anchor/layering PASS; controls PASS; overflow PASS; scroll viewport PASS.

- [Mock](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v7/vertigo_glass/mock/320x740-answered-viewport.png)
- [Docker](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/actual/320x740-answered-viewport.png)
- [Side-by-side](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/320x740-answered-viewport-side.png)
- [Overlay](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/320x740-answered-viewport-overlay.png)
- [Diff](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/320x740-answered-viewport-diff.png)

### 320x740-answered-bottom.png - PASS

Chrome PASS; heights/first viewport PASS; typography PASS; background PASS; asset identity/crop/anchor/layering PASS; controls PASS; overflow PASS; scroll bottom PASS.

- [Mock](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v7/vertigo_glass/mock/320x740-answered-bottom.png)
- [Docker](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/actual/320x740-answered-bottom.png)
- [Side-by-side](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/320x740-answered-bottom-side.png)
- [Overlay](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/320x740-answered-bottom-overlay.png)
- [Diff](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/320x740-answered-bottom-diff.png)

### 320x740-answered-expanded-top.png - PASS

Chrome PASS; heights/first viewport PASS; typography PASS; background PASS; asset identity/crop/anchor/layering PASS; controls PASS; overflow PASS; scroll top PASS.

- [Mock](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v7/vertigo_glass/mock/320x740-answered-expanded-top.png)
- [Docker](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/actual/320x740-answered-expanded-top.png)
- [Side-by-side](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/320x740-answered-expanded-top-side.png)
- [Overlay](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/320x740-answered-expanded-top-overlay.png)
- [Diff](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/320x740-answered-expanded-top-diff.png)

### 320x740-answered-expanded-viewport.png - PASS

Chrome PASS; heights/first viewport PASS; typography PASS; background PASS; asset identity/crop/anchor/layering PASS; controls PASS; overflow PASS; scroll viewport PASS.

- [Mock](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v7/vertigo_glass/mock/320x740-answered-expanded-viewport.png)
- [Docker](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/actual/320x740-answered-expanded-viewport.png)
- [Side-by-side](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/320x740-answered-expanded-viewport-side.png)
- [Overlay](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/320x740-answered-expanded-viewport-overlay.png)
- [Diff](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/320x740-answered-expanded-viewport-diff.png)

### 320x740-answered-expanded-bottom.png - PASS

Chrome PASS; heights/first viewport PASS; typography PASS; background PASS; asset identity/crop/anchor/layering PASS; controls PASS; overflow PASS; scroll bottom PASS.

- [Mock](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v7/vertigo_glass/mock/320x740-answered-expanded-bottom.png)
- [Docker](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/actual/320x740-answered-expanded-bottom.png)
- [Side-by-side](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/320x740-answered-expanded-bottom-side.png)
- [Overlay](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/320x740-answered-expanded-bottom-overlay.png)
- [Diff](/Users/amirhasanov/Projects/chat/docs/design/geo-chat/verification/v7/vertigo_glass/compare/320x740-answered-expanded-bottom-diff.png)
