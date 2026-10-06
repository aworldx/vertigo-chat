# Release 0.23.0 — 2026-10-06

User authorized committing all accumulated changes and updating production.
Base production: 0.22.0, 14ef48bf37a9d8817b752eb8a198cd6bed294400.
Accumulated work preserved in 009851d and merged with current production in 67fcf4a.
Tetris and Glass runtime code match production; the new runtime delta is Nice.
No database migrations or worker changes.

Linux Docker release checks: 138 React tests, TypeScript, ESLint/architecture,
Prettier, build, DTO consistency PASS. OpenAPI chat+tetris valid, 8 existing warnings.
Go chatlans/HTTP race, Tetris unit/HTTP/PostgreSQL race, vet/golangci PASS (0 issues).
TestPublicChatPostgres PASS on a newly created nice_release_023 database.
An initial run reused yesterday's test database and failed due to existing fixtures;
this was isolated test contamination, resolved by creating the fresh database.

Main-agent verifier PASS: Nice and Glass at 1440×900, 768×1024, 390×844,
844×390, 320×568; direct chat, reload, messages, menus, preferences,
custom light colours, private/addressed messages, pet, hide and player.
Nice keyboard-pet test now waits for the composer/socket after reload, avoiding
an input sent before reconnection. UI behavior unchanged.
Neighbor verifyPlayer PASS; complete targeted verify-go-tetris PASS including
multiplayer, observer, solo popup/mobile with delayed/offline replay, controls,
sound and results. Existing frozen design comparisons retained in REVIEW.md;
release functional scroll screenshots retained in functional/ and personally inspected.

Backup verified with pg_restore --list (348 entries):
/opt/backups/vertigo-chat/release-0.23.0-20261006/postgres.dump (503951 bytes, restrictive permissions).
Rollback API: registry.gitlab.com/aworldx1/vertigo-chat:api-14ef48bf37a9d8817b752eb8a198cd6bed294400.
Deploy only api using script/deploy-production after exact-SHA image publication.

Not run: full script/check, Safari/Firefox, physical devices, external media providers.
The new untracked docs/design/geo-chat directory appeared during release checks;
it belongs to concurrent work and is preserved outside this release.
