# GO-LIVE checklist — GoWild Planner

Deploy is Vercel git-driven. The project is **not** linked locally (no `.vercel`) and
there are no Vercel credentials in this environment, so the steps below are run by
Jason. Booking is always manual on Frontier — nothing here automates booking.

## 0. Human-gated prerequisites
- A Vercel account + the GitHub repo `Jason-Latz/gowild-planner` connected to it.
- A Supabase project (Postgres + Auth).
- A Resend account with a verified sending domain.
- **Secret rotation (advisable):** `.env` / `.env.local` hold live Supabase secrets
  (service-role key + DB password). They are gitignored and were never committed,
  but rotating them in Supabase before going public is recommended. This is Jason's
  call; do it here if desired.

## 1. Land the code
- All overnight work is on local `main` (fast-forwarded from `codex/optimize-itinerary-ranking`).
- Push it: `git push origin main`. (Not done autonomously — pushing may trigger a
  Vercel build if the repo is already connected.)

## 2. Link the Vercel project
- `vercel link` (or import the repo in the Vercel dashboard). Framework: Next.js (auto).
- The Python fli functions in `api/fli/*.py` build automatically from `requirements.txt`
  (`flights==0.8.4`) on Vercel's Python runtime — no extra config.

## 3. Set production environment variables (Vercel → Settings → Environment Variables)
Required (the app refuses to boot in production without these):
- `DATABASE_URL` — Supabase **pooled** connection string.
- `CRON_SECRET` — strong, ≥16 chars, not `dev-secret` (`openssl rand -hex 32`).
  Vercel automatically sends this as `Authorization: Bearer <CRON_SECRET>` on cron runs.
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — from Supabase → API.

Strongly recommended:
- `FLI_HTTP_SECRET` — strong random; the `/api/fli/*` endpoints **fail closed on
  Vercel** without it (the Node side sends it automatically once set).
- `RESEND_API_KEY` + `ALERT_FROM_EMAIL` (verified domain) — without the key, emails
  are logged as mocks, not sent.
- `NEXT_PUBLIC_APP_URL` — the production origin (e.g. `https://gowild.example.com`).

Leave as-is / optional:
- `ALLOW_HEADER_AUTH` — unset or `false`. NEVER `true` in production.
- `FLI_ENABLED` — `true` (default). `FLI_HTTP_BASE_URL` — leave blank (auto-uses the
  Vercel URL). `PROVIDER_A_*` / `PROVIDER_B_*` — leave blank (stubs; live data is fli).
- `SUPABASE_SERVICE_ROLE_KEY` — currently unused by the app.

## 4. Configure Supabase Auth
- Auth → URL Configuration → add `https://<your-domain>/auth/callback` (and the
  Vercel preview domain if used) to the **Redirect URLs** allowlist.
- Enable the Email provider (magic link). Customize the email template if desired.

## 5. Push the database schema
- There are **no migration files** (`prisma db push` is used), so schema drift is a
  real risk — push deliberately.
- With `DATABASE_URL` pointing at Supabase: `npm run prisma:generate && npm run db:push`.
- Optional seed (CHI = ORD + MDW origin group): `npm run db:seed`.

## 6. Deploy
- Promote a production deployment (push to `main`, or `vercel --prod` / promote in the
  dashboard). The cron (`vercel.json` → `POST /api/digest/run`) is registered on deploy.
  **It runs daily at 13:00 UTC** because the Vercel Hobby plan only allows daily cron;
  to restore the intended hourly cadence (so all per-timezone send windows fire),
  upgrade to Pro and set the schedule back to `0 * * * *`.

## 7. Verify (post-deploy smoke test)
- `GET /api/health` → `200`, `db.ok: true`, fli provider not degraded.
- Open `/` → redirected to `/login` → request a magic link → the email arrives
  (Resend) → the link lands on `/auth/callback` → redirected back signed in.
- Run a search → results show; if you see the amber "sample data" banner, fli/live
  data is unavailable (check `FLI_HTTP_SECRET` and the Python function logs).
- Save a watch + settings (round-trips through the authenticated session).
- Cron: in Vercel → Crons, confirm `/api/digest/run` is scheduled and fires hourly
  (check the function logs for a `200`). A manual check:
  `curl -X POST https://<domain>/api/digest/run -H "Authorization: Bearer <CRON_SECRET>"`.
- Confirm a real digest/alert email is delivered by Resend (use a Thursday send window
  or a test user whose send-window matches).

## 8. Guardrails (do NOT do autonomously)
- Do not promote to production or change prod env without Jason.
- Do not rotate live secrets autonomously (step 0).
- Keep `ALLOW_HEADER_AUTH` off in prod.
