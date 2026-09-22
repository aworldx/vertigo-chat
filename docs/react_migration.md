# Incremental React and API migration

The accepted [refactoring target](refactoring_target.md) defines the monorepo
layout, mandatory TypeScript, Clean Architecture/DDD boundaries and quality
gates. The current JSX screen is a transitional slice: convert it and its tests
to strict TypeScript, split UI/model/API responsibilities, and enable frontend
static checks before migrating another screen. These gates are planned, not
already enabled by this document.
For the working branch, current progress and next-session instructions, follow
the [Go + React migration plan](go_react_migration_plan.md).

The first slice is the public profile catalogue. The existing `Chat.Profiles`
and `Chat.Ranks` contexts remain responsible for queries and rank rules.
`ChatWeb.API.V1.ProfileController` adapts HTTP requests, and `ProfileJSON`
explicitly projects public fields. React never receives an Ecto user struct,
email, password hash, session identity, raw image bytes or storage keys.

## First iteration

| Route | Responsibility |
| --- | --- |
| `/profiles` | Existing LiveView catalogue; existing navigation still points here |
| `/profiles/react` | Standalone React catalogue for comparison and manual testing |
| `/api/v1/profiles?q=...&page=...` | Public, read-only search and pagination |
| `/api/v1/profiles/:nickname` | Public, read-only profile details |
| `/profiles/:nickname/photo` | Existing photo delivery endpoint |

The API contract is in [openapi/profiles.yaml](openapi/profiles.yaml).
Controller tests cover pagination, search, errors, public fields and photo URLs.
The original context and LiveView tests remain in place.

The React screen uses the same origin and the same account cookie as Phoenix.
Its server-rendered account controls still use ordinary authenticated Phoenix
forms with CSRF protection. The catalogue API is public, like the existing
catalogue, and has no mutations. No JWTs, new login flow or browser credential
storage are introduced. Future authenticated API mutations must explicitly load
the account session, enforce CSRF protection and pass the trusted user to contexts.

React is a separate esbuild entry and is loaded only on `/profiles/react`.
That page does not load `app.js` or start a LiveView socket. It uses the existing
Tailwind stylesheet and rank icons. Search requests are debounced and cancelled;
late responses cannot overwrite a newer result. Search, pagination and the open
profile live in the URL (`q`, `page`, `profile`), including browser back/forward.
Native modal dialogs provide focus trapping; closing restores focus. A second
modal displays full-size photos. Network errors have an explicit retry action.

## Local development and verification

Node.js 20.19+ (prefer a supported LTS release) and npm are required for assets.
Dependencies are pinned in `assets/package-lock.json` and installed by:

```sh
mix assets.setup
mix assets.build
mix phx.server
```

Open `http://localhost:4000/profiles/react`. To run a separate local server:

```sh
PORT=4030 YOUTUBE_WORKER_URL=http://localhost:4021 YOUTUBE_PROXY_BASE_URL=http://localhost:4021 mix phx.server
```

Verification commands:

```sh
npm --prefix assets test
mix test test/chat_web/controllers/api/v1/profile_controller_test.exs test/chat_web/controllers/react_profiles_controller_test.exs
mix precommit
```

`mix precommit` includes the React interaction tests, Go checks and Elixir tests.
The Docker Phoenix builder installs npm dependencies before building assets.
The Go worker image remains independent of the React build.

Manual checks: search by nickname and Cyrillic name; empty results; switch pages;
open an actual profile and its photo; close each dialog with Escape; navigate
back/forward; open a direct `?profile=nickname` link; check a missing profile;
repeat at a narrow viewport. Account settings and logout should still work.

## Subsequent iterations

First complete the TypeScript and quality-gate prerequisite above, preserving
the existing appearance and behaviour. Then proceed with the product slices:

1. After reviewing this slice, switch `/profiles` to the React screen and keep
   a temporary LiveView fallback. Keep `/api/v1` compatible during the switch.
2. Add one authenticated scenario (for example profile editing) with a documented
   mutation contract, server authorization and CSRF tests before migrating more UI.
3. Migrate further screens individually. Keep chat sessions, presence and realtime
   messages on the existing implementation until their lifecycle contracts are tested.
4. Move selected backend contexts to Go behind the same contracts. During a domain
   cutover, one implementation owns its writes and migrations; avoid dual writes.

Each step should be independently testable and reversible. This iteration has no
database migrations and does not change the site's default profile route.
