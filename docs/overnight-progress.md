# Overnight Progress Ledger — GoWild Planner → ship-ready

> Compaction-survival document. On resume after compaction: re-read the opening mission prompt + this file + recent `git log` + `architecture.md` before acting. Absolute dates only. Started 2026-06-16.

## Mission (one line)
Take GoWild Planner from its current branch tip to ship-ready: land the tip on `main`, fix the red-team bugs (headline = timezone/duration), make silent mock fallback visible, build real Supabase magic-link auth, test to ship-grade, keep all five gates green, and prepare deploy + a LinkedIn post draft. Booking stays manual on Frontier forever.

## Ground truth (verified this session)
- Repo: `/Users/jason/Downloads/CS Classes/Projects/GoWild_Planner` (standalone git).
- Branch `codex/optimize-itinerary-ranking` @ `c7bc41f` is the canonical tip: **2 commits ahead of `main`**, main is a clean ancestor (`0 2` from `main...branch`). DO NOT reset to main.
- `codex/gowild-v1` @ `d58297c` is an ancestor of the tip with **0 unique commits** (20 behind, 0 ahead) → safe to prune.
- Stack: Next.js 16.1.6 / React 19 / TS5 / Tailwind v4 / Prisma 6 / Supabase Postgres / Resend / Vitest 4 / Python `flights` (fli) bridge / Vercel hourly cron.
- Commands: `npm install` + `npm run prisma:generate`; dev `npm run dev`; build `npm run build`; test `npm run test` (vitest run); lint `npm run lint`; typecheck `npx tsc --noEmit` (NO npm script); `npm run check:architecture`; `npm run db:push`; `npm run db:seed`.
- Gates (all must pass): `npm run lint`, `npx tsc --noEmit`, `npm run test`, `npm run build`, `npm run check:architecture`.
- CI Architecture Guard: any change under `src/`, `prisma/`, `next.config.ts`, `package.json`, `vercel.json`, `AGENTS.md` REQUIRES `architecture.md` updated + a Change Log row in the SAME commit, else the guard fails. Use `docs-only`/`no-arch-impact` notes where applicable.

## Key code facts (verified by reading)
- **Timezone bug surface**: `scoreItinerary` (itinerary-service.ts) already computes `totalMinutes = sum(durationMinutes) + sum(layovers)` — correct IF inputs are. Layovers (`buildLayovers`/`isValidConnection`) are at a single connection airport → wall-clock subtraction is tz-safe there. Genuine defects: (a) `durationMinutes` recomputed via cross-tz subtraction in `provider-manager.normalizeLegs` fallback (line ~28), `provider-a.normalizeLeg` (line ~34), `provider-b.parseFlight` (line ~30); (b) FORMAT inconsistency: fli emits naive wall-clock strings, mock/A/B emit UTC `Z` strings via `new Date(x).toISOString()` → `matchesServiceDate` (`.slice(0,10)`) can drop mock evening flights that roll past midnight UTC (e.g. mock flight 1801 DEN→MCO 18:50 @ -06:00 = next-day UTC).
- **Auth**: `resolveUserEmail` (user-context.ts) honors `x-user-email` only when `allowHeaderAuth()` = `NODE_ENV!=='production' || ALLOW_HEADER_AUTH`. In prod with the flag unset the header path is closed and demo fallback is prod-gated (returns DEMO only when `NODE_ENV!=='production'`), else throws `UnauthorizedError`. No `/login` / magic-link UI yet → Phase D.
- **Cron**: env `CRON_SECRET` default `'dev-secret'`. Need to verify cron-auth gates `x-vercel-cron` to prod only and rejects dev-secret in prod.
- **Mock fallback**: providers A/B always mock (no creds); FliAdapter throws → failover silently returns mock as real. SearchResponse.meta has no `source`/degraded signal beyond cache/fresh. Phase B+D: surface it.
- **Env**: `env.ts` zod-validates; `FLI_ENABLED` defaults true; `FLI_HTTP_SECRET` optional (open-by-default on the Python endpoints — Phase B).

## Plan checklist (status) — ALL COMPLETE
- [x] Phase 0/2: ledger + task list + project `CLAUDE.md` (@imports architecture.md/AGENTS.md)
- [x] Background red-team audit `whvcksen3`: 51 findings + critique, all integrated
- [x] Phase A: `main` fast-forwarded to tip; `codex/gowild-v1` pruned; `CLAUDE.md` added
- [x] Phase B: timezone fix (+regression), naive-timestamp canonicalization, visible mock fallback, cron/env/header-auth/fli-http hardening, scraper hardening, validation parity, mailer escaping, claim-first dedupe — each with guard tests
- [x] Phase C: cache-key staleness fix, dead-code removal, fli health TTL, /api/health rate-limit; known limitations documented in architecture.md
- [x] Phase D: Supabase magic-link auth (`/login` + `/auth/callback` + session-gated `/`); dashboard off the x-user-email shim in session mode; visible data-source health
- [x] Phase E: tests added — timezone regression, auth resolution, API route handlers (/api/search, /api/digest/run), mailer, scraper, dedupe races, env validation, schema validation (62 JS tests, 8 Python tests)
- [x] Phase F: all five gates green (lint, `npx tsc --noEmit`, test, build, check:architecture)
- [x] Phase G: deploy-ready in repo (vercel.json cron correct, requirements.txt builds fli, .env.example prod-annotated); precise `docs/GO-LIVE.md` written
- [x] Phase H: `docs/launch/linkedin-post.md` (3 drafts); docs finalized

## Decisions / Assumptions
- Work lands on `main` per mission (DoD: "main fast-forwarded to the optimize tip"). Commit locally to `main`; **do NOT push to origin autonomously** (avoid triggering any Vercel deploy; pushing is a GO-LIVE step for Jason). Recorded as a decision; revisit if Jason wants it pushed.
- Many small, narrowly-scoped commits. Each src/prisma/config commit carries an architecture.md Change Log row.
- Keep solutions minimal; do not over-engineer.

## Red-team findings (prioritized — from workflow whvcksen3, 51 findings + critique)
Fix order P0 security → P1 correctness → P1 data-integrity → P2 trust → P3 hygiene. Each fix gets a guard test + arch Change Log row.

**P0 security (ship-open, exploitable):**
- [x] cron-auth: forgeable `x-vercel-cron:1` — secret-only timing-safe check (commit af8bb25).
- [x] env CRON_SECRET default `'dev-secret'` + DATABASE_URL — prod superRefine fail-closed (commit af8bb25).
- [x] header-auth impersonation — `allowHeaderAuth()` now requires explicit `ALLOW_HEADER_AUTH=true` (commit af8bb25).
- [x] fli HTTP endpoints fail-open + departureDate crash + reflection — hardened, fail-closed on Vercel, membership lookup, generic errors, Python unittest guards (commit 3d94aee).

**P1 correctness (timestamp canonicalization — THE headline bug):**
- [x] timezone duration/layover: authoritative durationMinutes + wall-clock face-value layovers (commit ab63e84).
- [x] `matchesServiceDate` UTC-roll drops evening flights — canonicalized mock (+provider-a/b) to naive local wall-clock (commit 836d6a6).
- [x] booking-service getDateForFrontier server-tz date → face-value slice (commit 836d6a6).

**P1 data-integrity:**
- [x] digest + watch send-then-record duplicate-email race → claim-first (commit 53eab94).
- [x] /api/digest/run maxDuration added (commit 53eab94). Rate-limit: decided NOT to per-IP-limit a secret-gated cron endpoint; /api/health gets the rate limit instead (P3).

**P2 trust/observability:**
- [x] silent mock fallback visible: meta.dataSource + dashboard banner + booking disabled + degraded chips; mock never cached (commit 7be7a82).
- [x] scraper: negative-cache eviction + strict slug allowlist + IATA guard + safe URL (commit 02e1905).

**P3 hygiene:**
- [x] env DATABASE_URL fail-open in prod → required in prod (commit af8bb25).
- [x] /api/health rate limit added (commit 6eb8c05).
- [x] mailer HTML/attr escaping (commit 64eb3cf).
- [x] watch exactDate isValidDateOnly + originGroup/settings regex parity (commit 5c1c44f).
- [x] search cache key includes resolved airports (commit 39bf1ee).
- [x] dead code removed: clampDate, isSameDate, getDefaultDigestSendDay, DEFAULT_SEND_TIME, returnMemo (commit 39bf1ee).
- [x] fli health TTL (commit 6eb8c05); per-instance limiter/module-cache cold-start semantics documented in architecture.md.

**Deferred as documented known-minor (low severity, see architecture.md "Known Limitations"):** rate-limiter `cleanupExpired` O(n)/request; fli `healthCheck` latency reflects memoized probe; `updateSettings` re-reads via upsert-shaped getSettings; `digestEvent.fingerprint` stored but unused; `requireReturn` only disables on literal `"false"`; per-instance rate limiter & module caches give no cross-instance guarantee on Vercel (needs shared store for strict global limits).

**Re-scoped/dropped (per critique):** provider-a/b "cross-tz subtraction" CRITICALs are NOT defects for offset-bearing timestamps — already correctly handled (prefer authoritative field, keep offset-aware fallback). Do not over-fix.

## What's left (HUMAN-GATED only)
All autonomous work is complete and verified. Remaining items are Jason's calls (see `docs/GO-LIVE.md`):
- Push `main` to origin (not done autonomously to avoid triggering a Vercel build).
- Link the Vercel project, set production env vars, configure Supabase Auth redirect URLs, `prisma db push` to Supabase, promote to production.
- Rotate the live Supabase secrets in `.env`/`.env.local` (advisable).
- Pick/post a LinkedIn draft from `docs/launch/linkedin-post.md`.

## Final state (2026-06-16)
- Branch: local `main`, ~22 small commits ahead of `origin/main`, fast-forwarded from the optimize tip.
- Gates: lint clean, `npx tsc --noEmit` clean, 62 JS tests + 8 Python tests pass, `npm run build` passes, `npm run check:architecture` passes.
- Booking remains manual on Frontier (product invariant upheld). No prod promote / secret rotation / push done autonomously.

## How to verify
Run all five gates after each milestone. Final: lint + `npx tsc --noEmit` + test + build + check:architecture all green on `main`.

## Open questions for Jason (HUMAN-GATED)
- Rotating live Supabase secrets before ship (advisable; Jason's call — in GO-LIVE).
- Pushing `main` to origin / linking + promoting the Vercel project (not done autonomously).
- Whether to seed origin groups beyond CHI.
