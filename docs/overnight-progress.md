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

## Plan checklist (status)
- [x] Phase 0/2: create this ledger + task list (DONE 2026-06-16)
- [~] Background: red-team audit workflow `whvcksen3` running (8 dimensions + completeness critic)
- [ ] Phase A: fast-forward `main` to tip; prune `codex/gowild-v1`; add project `CLAUDE.md` (@imports architecture.md/AGENTS.md)
- [ ] Phase B: fix red-team bugs (headline timezone + regression test; visible mock fallback; auth/cron/scraper/fli-http/validation/dedupe) — each with guard test
- [ ] Phase C: optimization & mistakes sweep (rate limiter / caches documented or fixed)
- [ ] Phase D: real Supabase magic-link auth (login page + callback + client session); dashboard off the x-user-email shim; visible data-source health
- [ ] Phase E: ship-grade tests (timezone regression, auth resolution, API route handlers, mailer, non-CHI origin, dedupe races)
- [ ] Phase F: all five gates green
- [ ] Phase G: deploy-readiness + precise GO-LIVE checklist (no autonomous prod promote / secret rotation)
- [ ] Phase H: docs/launch/linkedin-post.md (2-3 drafts, draft only); finalize CLAUDE.md/architecture.md/this ledger/GO-LIVE

## Decisions / Assumptions
- Work lands on `main` per mission (DoD: "main fast-forwarded to the optimize tip"). Commit locally to `main`; **do NOT push to origin autonomously** (avoid triggering any Vercel deploy; pushing is a GO-LIVE step for Jason). Recorded as a decision; revisit if Jason wants it pushed.
- Many small, narrowly-scoped commits. Each src/prisma/config commit carries an architecture.md Change Log row.
- Keep solutions minimal; do not over-engineer.

## What's left
Everything in Phases A–H (see checklist). Integrate red-team workflow findings when `whvcksen3` completes.

## How to verify
Run all five gates after each milestone. Final: lint + `npx tsc --noEmit` + test + build + check:architecture all green on `main`.

## Open questions for Jason (HUMAN-GATED)
- Rotating live Supabase secrets before ship (advisable; Jason's call — in GO-LIVE).
- Pushing `main` to origin / linking + promoting the Vercel project (not done autonomously).
- Whether to seed origin groups beyond CHI.
