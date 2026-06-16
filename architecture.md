# GoWild Explorer Architecture

## Purpose
This document is the single source of truth for how the GoWild Explorer system is designed today.
It is written for future coding agents and engineers to understand the full context quickly and make safe changes.

## Mandatory Maintenance Rule
When any code change is made in this repository, this file must be updated in the same change set.
At minimum:
1. Update impacted sections below.
2. Add one entry to the **Architecture Change Log**.
3. If public API, schema, or behavior changed, update the **Interfaces** section with exact details.

If no architecture behavior changed, add a Change Log entry explicitly stating `docs-only` or `no-arch-impact`.

## Product Boundaries
- This app is a **planning and discovery** tool, not an automated booking tool.
- Final booking is always manual on Frontier.
- No Frontier credentials or session cookies are collected.
- Round-trip feasibility is first-class: users can require a valid return to the same origin metro group.

## System Overview
GoWild Explorer is a Next.js App Router web app with server route handlers, a Prisma data layer targeting Supabase Postgres, and optional Supabase Auth session resolution.

### Major Runtime Components
- `UI`: Search/workflow dashboard for users.
- `API Layer`: Route handlers in `src/app/api/*`.
- `Domain Services`: Search, itinerary graphing, watches, digest scheduling, and email dispatch.
- `Provider Adapters`: Primary/secondary external data adapters with normalized output and failover.
- `Fli Bridge`: Python bridge layer that wraps the `flights` package for Google Flights-backed Frontier route timing queries.
- `Persistence`: Prisma models in Supabase Postgres.
- `Scheduler`: Vercel cron calling `/api/digest/run` hourly.

## Directory Map
- `src/app/`:
  - `page.tsx`: root page mounting dashboard.
  - `api/*`: JSON route handlers.
- `src/components/`:
  - `gowild-dashboard.tsx`: main UI container.
- `src/lib/`:
  - `api/`: error contracts, response helpers, and in-memory rate limiting.
  - `auth/`: user context and Supabase client helpers.
  - `providers/`: Provider adapter contracts and implementations.
  - `services/`: Domain/business logic.
  - `types/`: Shared domain types for API + services.
  - `utils/`: Date/hash helpers.
  - `env.ts`: runtime env parsing/validation.
  - `prisma.ts`: Prisma singleton client.
- `prisma/`:
  - `schema.prisma`: source of DB schema.
  - `seed.ts`: initial data seeding.
- `scripts/`:
  - `fli_search.py`: Python bridge used by the live `fli` provider.
- `api/fli/`:
  - `health.py`: Vercel Python function for `fli` health checks.
  - `search.py`: Vercel Python function for per-route `fli` searches.
- `fli_bridge.py`:
  - shared Python search/health logic used by both CLI and Vercel Python functions.
- `vercel.json`: scheduled cron definition.

## Request and Data Flows

### 1) Search Flow
1. `GET /api/search` receives query params and validates with `searchRequestSchema`.
2. `search-service` checks `search_results_cache` using a deterministic hash.
3. On miss, `search-service` resolves origin input as either:
   - known metro group code (example `CHI`) -> airports from `origin_groups` + `origin_group_airports`
   - generic 3-letter airport code (example `DEN`) -> direct single-airport origin
4. For each queried airport/date, provider legs are loaded from cache or adapter failover (`provider-fli` -> A -> B).
5. `provider-fli` resolves direct Frontier route candidates from Frontier's public `flights-from-*` pages.
6. `provider-fli` then executes one of two transports:
   - `http`: call Vercel Python functions at `/api/fli/*`
   - `local`: shell out to `scripts/fli_search.py`
7. The Python bridge uses `fli` / Google Flights-backed data for non-stop route timing data.
8. `itinerary-service` enumerates paths up to 2 stops, applies layover/loop constraints, scores itineraries, and returns them in best-first order.
9. `search-service` keeps only the first outbound seen for each destination and the first return match per date window, so it can reuse the pre-ranked itinerary order instead of re-sorting filtered subsets.
10. Results are sorted, booking handoff URL is generated, and response is cached.

### 2) Watches Flow
1. User saves watch via `POST /api/watches`.
2. Watch record is stored in `watch_rules`.
3. Cron run executes `runWatchAlerts()`:
   - evaluates each active watch via `search-service`.
   - creates dedupe hash from top results.
   - sends email if dedupe key not seen.
   - stores event in `alert_events`.

### 3) Thursday Digest Flow
1. Hourly cron invokes `POST /api/digest/run`.
2. `runDigest()` loads users + digest preferences.
3. Per user, checks local timezone send window and weekly dedupe key (`isoWeek`).
4. Searches upcoming Friday/Saturday departures with round-trip requirement.
5. Sends digest email (or optional empty digest).
6. Persists digest event in `digest_events`.

## Core Domain Rules

### Itinerary Rules
- Max `2` stops (`3` legs total).
- No airport loops within a single itinerary.
- Min layover:
  - Domestic: `45` min.
  - International: `75` min.
- Max layover: `360` min.
- Overnight layover limit: `480` min.

### Ranking
- Fewer stops first.
- Then shorter total duration.
- Then lower composite score (duration + layover penalty).
- Then earlier departure tie-break.
- `totalMinutes` must be derived from `sum(leg.durationMinutes) + sum(layovers)` rather than timestamp subtraction because `fli` returns local wall-clock datetimes without timezone offsets.
- Per-leg duration comes from the provider's **authoritative `durationMinutes`** field. Layover minutes are the **wall-clock face-value difference** at the single connecting airport (`wallClockDiffMinutes` in `src/lib/utils/date.ts`, which ignores any offset/`Z`). Absolute-instant subtraction (`new Date(arr) - new Date(dep)`, `differenceInMinutes(parseISO(...))`) is never used for leg durations or layovers — it is wrong when legs span timezones.

### Timestamp Representation
- All adapters emit **naive local wall-clock** departure/arrival strings (no timezone offset, no `Z`): `fli` natively, `mock-data` by construction, and `provider-a`/`provider-b` by preserving the source string instead of converting to UTC.
- `matchesServiceDate` and booking-date generation read the **date face value** (`.slice(0,10)`), so an evening departure can never roll past UTC midnight onto the wrong service date (the previous UTC-conversion bug silently dropped late flights).
- Local-time display (`new Date(ts)` + `format`) round-trips the wall-clock face value on any server timezone.

### Return Feasibility
- Destination must have at least one valid return itinerary to any airport in origin metro group.
- Return date is searched from `departDate + minNights` through `departDate + maxNights`.

## Interfaces

### Public API Endpoints
- `GET /api/search`
  - Query: `originGroup`, `departDate`, `maxStops`, `requireReturn`, `minNights`, `maxNights`
- `GET /api/watches`
- `POST /api/watches`
- `DELETE /api/watches/:id`
- `GET /api/settings`
- `PUT /api/settings`
- `POST /api/digest/run`
- `GET /api/health`

### API Error Contract
- All route handlers should return structured JSON errors:
  - `error`: user-facing message
  - `code`: machine code (`VALIDATION_ERROR`, `RATE_LIMITED`, etc.)
  - `details`: optional metadata (for example retry-after seconds)

### Auth Resolution
Current behavior:
- If Supabase session user exists, use that email.
- In non-production mode, `x-user-email` header and demo fallback are supported.
- In production, header auth is disabled unless `ALLOW_HEADER_AUTH=true`.
- Production must not rely on header spoofing.

### Origin Code Semantics
- Known metro codes are explicit and mapped in `ORIGIN_GROUP_FALLBACKS`.
- Any non-metro 3-letter code is treated as a direct airport.
- Invalid origin codes are rejected with validation errors.
- This prevents accidental fallback of arbitrary origin input to Chicago defaults.

### Rate Limiting
- Search and mutating endpoints apply in-memory per-IP rate limits.
- This limiter is process-local and primarily protects accidental abuse.
- If deployed to multiple instances, replace with shared-store rate limiting for strict global guarantees.

### Output Shapes (selected)
- `SearchResponse`: metadata + array of destination cards.
- `SearchResultCard`: best outbound itinerary + return feasibility + booking handoff metadata:
  - `bookingUrl`
  - `bookingFallbackUrl`
  - `bookingDetailsText`
- `FlightLeg`: normalized provider leg data including `durationMinutes`.
- `DigestRunResult`: counts for `processedUsers`, `sentEmails`, `skippedUsers`, and `failedUsers`.

## Data Model (Prisma)
Primary tables:
- `users`
- `origin_groups`
- `origin_group_airports`
- `provider_legs_cache`
- `search_results_cache`
- `watch_rules`
- `digest_preferences`
- `digest_events`
- `alert_events`

Key constraints:
- `digest_events` unique by `(user_id, iso_week, digest_type)`.
- `alert_events.dedupe_hash` unique.

## Reliability and Ops

### Caching
- Provider leg cache TTL: 30 minutes.
- Search result cache TTL: 15 minutes.

### Health
- `GET /api/health` checks DB query + provider health probes.
- `provider-fli` health checks the active bridge transport and installed `flights` package, but does not probe every Frontier route page.

### Cron
- `vercel.json` runs `/api/digest/run` hourly.
- Request must include `CRON_SECRET` (header or bearer auth).

## Security Posture
- No automated booking execution.
- No Frontier credentials/cookies persisted.
- Secrets managed through env vars and host secret store.
- Production auth should be session-based via Supabase.

## Development Workflow
1. `npm install`
2. `npm run prisma:generate`
3. Install the Python `flights` package for live route discovery:
   - Example: `python3 -m venv .fli-venv && .fli-venv/bin/pip install flights`
   - Then set `FLI_PYTHON_BIN=.fli-venv/bin/python`
4. `npm run db:push`
5. `npm run db:seed`
6. `npm run dev`

### Vercel Runtime Notes
- Vercel hosting should use HTTP bridge mode instead of local subprocess mode.
- Python bridge endpoints live in `api/fli/*.py` and install dependencies from `requirements.txt`.
- Set `FLI_HTTP_SECRET` in Vercel to protect direct access to the Python endpoints.
- `provider-fli` auto-selects HTTP mode when `VERCEL_URL` is present, or when `FLI_HTTP_BASE_URL` is explicitly set.

Validation checks:
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run check:architecture` (local architecture-guard check)

CI guard:
- `.github/workflows/architecture-guard.yml` enforces that `architecture.md` changes whenever core architecture files change in a PR.

## Planned Extension Points
- MCP server wrapper around service layer (`SearchService`, `WatchService`, `DigestService`).
- Additional provider adapters.
- Destination preference scoring (temperature, distance, novelty).
- Better auth UX with explicit magic-link sign-in flow.
- Replace the Python bridge entirely with a pure TypeScript or external hosted implementation if Vercel Python runtime constraints become a bottleneck.

## Architecture Change Log
| Date (UTC) | Summary | Files |
|---|---|---|
| 2026-03-04 | Created baseline architecture guide with mandatory update protocol and full system map. | `architecture.md` |
| 2026-03-04 | Added API error contract + route rate limiting, hardened auth header behavior, enriched booking fallback metadata, improved operational/test coverage, and added CI guard for mandatory architecture updates. | `src/lib/api/*`, `src/app/api/*`, `src/lib/auth/user-context.ts`, `src/lib/services/*`, `src/components/gowild-dashboard.tsx`, `.github/workflows/architecture-guard.yml`, `scripts/check-architecture-update.sh`, `README.md` |
| 2026-03-05 | Fixed origin parsing bug by treating non-metro 3-letter codes as direct airports (instead of Chicago fallback), and versioned search cache keys to avoid stale semantic cache reuse. | `src/lib/services/user-service.ts`, `src/lib/services/search-service.ts`, `src/lib/services/*.ts`, `src/components/gowild-dashboard.tsx`, `README.md` |
| 2026-04-16 | Added a live `fli` provider bridge that discovers Frontier routes from public `flights-from-*` pages, shells out to a Python `flights` helper for non-stop timing data, and changed itinerary duration scoring to use `durationMinutes` plus layovers for timezone-safe calculations. | `src/lib/providers/*`, `scripts/fli_search.py`, `src/lib/services/itinerary-service.ts`, `src/lib/types/domain.ts`, `README.md`, `AGENTS.md` |
| 2026-04-17 | Refactored the `fli` bridge to support Vercel-friendly HTTP transport via Python functions in `api/fli/*`, while keeping the local subprocess bridge for development and non-Vercel hosts. | `api/fli/*`, `fli_bridge.py`, `scripts/fli_search.py`, `src/lib/providers/provider-fli.ts`, `src/lib/env.ts`, `README.md`, `AGENTS.md` |
| 2026-04-28 | Removed repeated itinerary re-sorts in `search-service` by treating `buildItineraries()` output as a best-first stream and taking the first outbound/return match per destination window. | `src/lib/services/search-service.ts`, `src/lib/services/itinerary-service.ts`, `src/lib/services/itinerary-service.test.ts`, `architecture.md` |
| 2026-06-16 | Fixed timezone-correctness bug: layovers/connections now use wall-clock face-value differences (`wallClockDiffMinutes`) instead of absolute-instant subtraction, and providers prefer authoritative `durationMinutes` over cross-timezone subtraction. Added cross-tz regression tests. | `src/lib/utils/date.ts`, `src/lib/services/itinerary-service.ts`, `src/lib/services/itinerary-service.test.ts`, `src/lib/providers/provider-manager.ts`, `src/lib/providers/provider-a.ts`, `src/lib/providers/provider-b.ts`, `architecture.md` |
| 2026-06-16 | Canonicalized all adapters to naive local wall-clock timestamps (mock + provider-a/b stop UTC conversion), fixing the headline `matchesServiceDate` UTC-roll that silently dropped evening flights, and made booking-date generation timezone-deterministic. Added mock-data + booking regression tests. | `src/lib/providers/mock-data.ts`, `src/lib/providers/mock-data.test.ts`, `src/lib/providers/provider-a.ts`, `src/lib/providers/provider-b.ts`, `src/lib/services/booking-service.ts`, `src/lib/services/booking-service.test.ts`, `architecture.md` |
