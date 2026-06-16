# CLAUDE.md — GoWild Planner

Project entry point Claude auto-loads. Durable, high-signal only. The full system map lives in the imported docs below — read them before changing code.

@architecture.md
@AGENTS.md

## Product contract (one line)
Discover round-trip-feasible Frontier "GoWild" weekend itineraries from an origin metro group, with saved watches (deduped alert emails) and a weekly Thursday digest. **Booking is always handed off manually to Frontier — never automate booking or store Frontier credentials.**

## Architecture / context
The single source of truth is **`architecture.md`** (imported above): full system map, domain rules, interfaces, and the Architecture Change Log. `AGENTS.md` (imported above) holds the manual-booking invariant, Supabase-cloud-first, Thursday digest, return-feasibility-first, Prisma-v6 pin, the no-Chicago-fallback origin rule, and the "treat fli timestamps as local wall-clock" rule. The overnight work ledger is `docs/overnight-progress.md`.

## Gate commands (all must pass before "done")
- `npm run lint`
- `npx tsc --noEmit`  ← typecheck has **no** npm script; run this directly
- `npm run test`  (vitest run)
- `npm run build`
- `npm run check:architecture`  (CI architecture guard; see below)

Setup: `npm install` → `npm run prisma:generate`. DB: `npm run db:push` (no migration files — schema drift is a real risk), `npm run db:seed` (CHI=ORD+MDW only). Python fli bridge: `python3 -m venv .fli-venv && .fli-venv/bin/pip install flights`, then `FLI_PYTHON_BIN=.fli-venv/bin/python`.

## CRITICAL — Architecture Guard
`.github/workflows/architecture-guard.yml` + `npm run check:architecture` FAIL the build unless `architecture.md` is updated **with a Change Log row** in the same change set as any change to `src/`, `prisma/`, `next.config.ts`, `package.json`, `vercel.json`, or `AGENTS.md`. Update `architecture.md` as part of the task, not after. Use a `docs-only`/`no-arch-impact` note where applicable.

## Branch reality
`main` is the canonical branch and holds the latest tip (fast-forwarded up from the former `codex/optimize-itinerary-ranking`, which it now equals). New work lands on `main` in many small, narrowly-scoped commits. Do not "reset to main" expecting older state. Pushing to origin / linking + promoting Vercel is a human GO-LIVE step (see `docs/overnight-progress.md` and the GO-LIVE checklist) — not done autonomously.

## Conventions
- Many small, reviewable commits; keep solutions minimal; verify before declaring done.
- Pin Prisma v6 (no v7 without `prisma.config.ts` + sign-off).
- Origin parsing must never fall back to Chicago — known metro codes map explicitly; other 3-letter codes are direct airports.
- fli departure/arrival timestamps are **local wall-clock with no tz offset**: derive durations from authoritative `durationMinutes`, and layovers from same-airport wall-clock differences — never subtract cross-timezone timestamps.
