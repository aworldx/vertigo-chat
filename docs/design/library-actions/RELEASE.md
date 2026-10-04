# Library release 0.20.0 — 2026-10-04

Scope: library covers and inline images, series metadata editing, likes and personal bookmarks; migration 0013, API/DTO/help and targeted tests. Unrelated chat theme changes are excluded.

The complete Docker `script/check-target` gate passed (exit 0) on the exact isolated release sources, including VERSION 0.20.0. It is the entire Linux payload invoked by `script/check`: generated contracts, TypeScript, ESLint and architecture, formatting, Go vet/race/build/golangci-lint, real PostgreSQL, all Go/React coverage and browser scenarios, infrastructure and OpenAPI. New library PostgreSQL tests are now included in `collect-go-coverage` as well as the fast library script. Thresholds were not reduced.

Initial full `script/check` stopped on a Chromium precise-coverage collection race in the existing personal-settings scenario. A rebuild attempt hit Docker Registry TLS timeout. The successful full rerun reused the already-built pinned `chat-quality:local` image with the updated coverage collector copied in. The same browser scenario passed on rerun. Go API coverage: 90.01%; worker: 92.43%. Web coverage and all static/infrastructure checks passed. Existing OpenAPI warnings remain non-blocking.

Verifier: actual browser interactions with the real Go API/PostgreSQL passed, including upload and persisted image content, inline cursor placement, cover removal, entire-series rename, author permissions, repeatable likes/bookmarks, private filtering after reload, HTTP failure recovery, anonymous/CSRF rejection. Existing editor, article import/authorship, gallery, accounts, chat, player, polls and Tetris regressions also passed. Frozen design PNGs compare successfully for desktop/tablet/mobile and top/viewport/bottom states; the original near-pixel review remains in REVIEW.md.

Logs and aggregate coverage: coverage/library-release (ignored local output). No unverified functional blocker remains; physical-device/browser engines other than the pinned Chromium were not tested. Production backup was created and checked with pg_restore --list before deployment. Deploy only the tagged API image; no worker change is required.
