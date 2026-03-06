# GoWild Explorer

Supabase-first Next.js app for exploring Frontier itineraries with return-feasibility checks, saved watches, and a Thursday weekend digest.

## Architecture Guide

- Full architecture context for future agents lives in [architecture.md](/Users/jason/Downloads/CS Classes/Projects/GoWild_Planner/architecture.md).
- Every code change must also update `architecture.md` (including change log entry).

## What It Implements

- One-to-many search from an origin metro group (default `CHI = ORD + MDW`).
- Origin input supports either metro group codes (example `CHI`) or single airport codes (example `DEN`).
- Direct, 1-stop, and 2-stop itinerary generation.
- Return feasibility checks to the same origin metro (`requireReturn` defaults to `true`).
- Saved watches with deduped alert emails.
- Thursday weekly digest for weekend-capable round trips.
- Manual booking handoff via Frontier booking URL generation.
- Provider adapter failover (A -> B) with normalized cache in Postgres.

## Tech Stack

- Next.js 16 (App Router + TypeScript + Tailwind)
- Prisma ORM with Postgres (Supabase)
- Optional Supabase Auth session support + header fallback in development
- Resend for email delivery
- Vercel Cron support (`/api/digest/run`)

## Environment

Copy `.env.example` to `.env` and set values:

```bash
cp .env.example .env
```

Required for full runtime:

- `DATABASE_URL`
- `CRON_SECRET`
- `ALLOW_HEADER_AUTH` (defaults to false; enable only for trusted non-production workflows)
- `RESEND_API_KEY` + `ALERT_FROM_EMAIL` (for real email)
- Provider credentials (`PROVIDER_A_*`, optional `PROVIDER_B_*`)

## Setup

```bash
npm install
npm run prisma:generate
npm run db:push
npm run db:seed
npm run dev
```

## API Endpoints

- `GET /api/search?originGroup=CHI&departDate=YYYY-MM-DD&maxStops=2&requireReturn=true&minNights=1&maxNights=3`
- `POST /api/watches`
- `GET /api/watches`
- `DELETE /api/watches/:id`
- `GET /api/settings`
- `PUT /api/settings`
- `POST /api/digest/run` (requires `x-cron-secret` or `Authorization: Bearer <CRON_SECRET>`)
- `GET /api/health`

## Testing and Lint

```bash
npm run lint
npm run test
npm run check:architecture
```

## Vercel Cron

`vercel.json` schedules `/api/digest/run` hourly.

Make sure Vercel has `CRON_SECRET` configured so cron authorization succeeds.

## Notes on Frontier Safety

- No automated login/booking flows are implemented.
- No Frontier credential or cookie storage is implemented.
- Handoff is manual via Frontier booking page link.
