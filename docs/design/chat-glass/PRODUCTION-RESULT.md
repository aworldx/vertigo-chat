# Production release 0.21.0

Published commit ce8cce1509db08ba78564d4e41b8b960053a8216 and annotated tag v0.21.0 to both authorized remotes (GitHub aworldx/vertigo-chat, GitLab aworldx1/vertigo-chat).

Deployed with script/deploy-production api from clean isolated checkout. Production git HEAD and API image match release SHA; API reports healthy and VERSION is 0.21.0. Worker unchanged. Pre-deploy PostgreSQL backup verified: /opt/backups/vertigo-chat/release-0.21.0-20261004/postgres.dump.

Full isolated Docker quality gate and glass-specific verifier passed before publication. Production browser verified guest login, persisted glass theme/reload, both frame modes, reflection CSS and desktop/mobile overflow. No public test messages sent. Final production visual verification remains incomplete: screenshots were taken before background/cat image download finished; subsequent retries encountered slow external HTTPS loads/timeouts and a temporarily reserved nickname after interruption. Do not treat those PNGs as visual acceptance. Approved local Docker 50-state visual comparison remains retained separately. External /health returned HTTP 200. No application rollback performed: deployment identity/health and functional smoke are good, but complete production visual confirmation is not claimed.
