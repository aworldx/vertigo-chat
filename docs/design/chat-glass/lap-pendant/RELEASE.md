# Release 0.22.0

Based on production 0.21.3 (e0560d4). Only Glass scene, player styling, pet target, hidden-cat variant, help and targeted checks. No server, contract, database or worker changes.

Isolated Linux Docker: 16 unit tests, TypeScript, ESLint, architecture, production build PASS. Verifier /chat covers 1440x900, 768x1024, 390x844, 844x390, 320x568; reload, messages, menus, preferences, theme isolation, pointer/keyboard petting, hiding and player collapse. Neighbor verifyPlayer covers playback, queue, seek/volume and mobile inline.

69 reference and actual PNGs retained with REVIEW.md. Generated comparison-* side-by-side/overlay/diffs are retained locally outside Docker and reproducible with compare.mjs; excluded from Git due to size. Full script/check not run. Safari/Firefox, physical devices and external media providers not tested.

Backup: /opt/backups/vertigo-chat/release-0.22.0-20261005/postgres.dump. Deploy with script/deploy-production api after GitLab image publication. Rollback image: api-e0560d4e5f96bba60d532e41fb9f032d55b64b0a.
