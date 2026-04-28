# GoWild Explorer

Supabase-first Next.js app for exploring Frontier itineraries with return-feasibility checks, saved watches, and a Thursday weekend digest.

## Architecture Guide

- Full architecture context for future agents lives in [architecture.md](/Users/jason/Downloads/CS Classes/Projects/GoWild_Planner/architecture.md).
- Every code change must also update `architecture.md` (including change log entry).
- Search assembly now reuses the best-first ordering returned by `itinerary-service` so outbound and return filtering do not re-sort each destination subset.

## What It Implements

- One-to-many search from an origin metro group (default `CHI = ORD + MDW`).
- Origin input supports either metro group codes (example `CHI`) or single airport codes (example `DEN`).
- Direct, 1-stop, and 2-stop itinerary generation.
- Return feasibility checks to the same origin metro (`requireReturn` defaults to `true`).
- Saved watches with deduped alert emails.
- Thursday weekly digest for weekend-capable round trips.
- Manual booking handoff via Frontier booking URL generation.
- Provider adapter failover (`fli` -> A -> B) with normalized cache in Postgres.
- Vercel-friendly `fli` bridge:
  - local dev / non-Vercel hosts can use the Python CLI bridge
  - Vercel deploys can use Python functions at `/api/fli/*`

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
- `FLI_ENABLED` + `FLI_PYTHON_BIN` (for Google Flights-backed live route discovery)
- `FLI_HTTP_BASE_URL` + optional `FLI_HTTP_SECRET` (for HTTP bridge mode, including Vercel)

## Setup

```bash
npm install
npm run prisma:generate
python3 -m venv .fli-venv
.fli-venv/bin/pip install flights
npm run db:push
npm run db:seed
npm run dev
```

Set `FLI_PYTHON_BIN=.fli-venv/bin/python` in `.env.local` if you use a project-local Python environment.

## Vercel Deployment

This repo is now structured so Vercel can host the app without the Next.js server needing to spawn a local Python process.

- Node/Next.js app routes stay under `src/app/api/*`
- Python `fli` bridge endpoints live at:
  - `api/fli/health.py`
  - `api/fli/search.py`
- Python dependencies are installed from `requirements.txt`

Recommended Vercel env:

```bash
FLI_ENABLED=true
FLI_HTTP_SECRET=your-random-secret
```

The app will automatically use the Vercel deployment URL for the internal `fli` HTTP bridge when `VERCEL_URL` is present.
If you want to override that, set:

```bash
FLI_HTTP_BASE_URL=https://your-app.vercel.app
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
- The live `fli` provider uses public Frontier route pages plus Google Flights-backed search data; it does not touch your Frontier account session.
