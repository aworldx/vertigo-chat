# Vertigo Glass — release 0.21.0

Scope: new personal vertigo_glass theme, strict client/server preference support, responsive CSS, the approved evening background and black Karmik illustration, help and browser coverage. Other themes are unchanged. No new DB migrations or worker changes.

Approved design: soft cold reflections top-left, warm light above, transparent header/composer and readable message surfaces. Framed mode uses individual cards without a shared border; compact mode retains one reading pane. Artwork crop and Karmik position remain as approved.

Pre-release verification from an isolated checkout based on v0.20.0: full Docker script/check PASS (contracts, TypeScript, lint, formatting, Go/race/PostgreSQL, React coverage, browser scenarios, infrastructure). Additional script/verify-go-glass PASS on a separate test DB/API at 1440×900, 768×1024, 390×844, 844×390 and 320×568. Covers direct /chat, guest login, reload, preference persistence, both frame modes, real message delivery/reload, menus/settings/emoji, theme isolation and pet happy/reduced-motion.

Visual evidence retained in the original workspace at /Users/amirhasanov/Projects/chat/docs/design/chat-glass/: LIGHT-FROZEN.sha256, LIGHT-REVIEW.md, mock-light-{framed,plain}, actual-light-{framed,plain}, comparison-light-{framed,plain}. Fifty matched mock/actual states (top/viewport/bottom/commands/settings across five sizes and two modes): 0% channel differences above 12/255. Original references are not regenerated to match implementation. Large exploratory image iterations are deliberately excluded from the release commit.

Production backup verified with pg_restore --list before deployment: /opt/backups/vertigo-chat/release-0.21.0-20261004/postgres.dump (0600). Deploy API only from the release SHA; previous API image 7803fbef2e3576b5f52afb9e20e7035726d292fc is the rollback target. Existing YouTube worker remains unchanged.

Limitations: Chromium checked; Safari/Firefox and physical-device rendering/audio not independently verified. Decorative figure can sit behind a long participant list; it does not overlay controls.
