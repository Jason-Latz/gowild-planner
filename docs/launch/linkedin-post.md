# LinkedIn post — GoWild Planner (DRAFTS — do not post)

Three variants below. Pick one, tweak the voice, add a screenshot/GIF of the
dashboard, and post manually. All claims reflect what's actually built.

---

## Variant A — builder / engineering angle

I kept missing cheap Frontier "GoWild" weekend escapes — the fares are there, but
only if you happen to be looking at the right moment and there's a way *back*. So I
built GoWild Planner to watch for me.

What it does:
• Searches round-trip-**feasible** itineraries from your home metro (it won't show you
  a deal you can't actually return from).
• Lets you save watches that email you when a qualifying trip appears — deduped, so no
  spam.
• Sends a weekly Thursday digest of weekend-ready options.
• Hands you off to Frontier to book — it never touches your payment or credentials.

The fun engineering bits:
• A Python bridge wrapping Google-Flights-backed data for real non-stop timing, running
  as **Vercel Python functions** alongside the Next.js app.
• Next.js 16 / React 19 / TypeScript, Prisma on Supabase Postgres, Resend for email,
  an hourly Vercel cron driving the digest + alerts.
• A correctness detail I'm weirdly proud of: flight times are local wall-clock with no
  timezone offset, so durations come from authoritative fields and layovers from
  same-airport wall-clock math — never naive timestamp subtraction across timezones.

Booking stays manual on purpose. This is a discovery tool, not a bot.

#buildinpublic #nextjs #typescript #supabase #vercel

---

## Variant B — product / story angle

Frontier's "GoWild" pass makes spontaneous weekend trips dirt cheap — if you can catch
an open seat with a viable way home. I was tired of refreshing flight pages, so I built
GoWild Planner.

Tell it your home airports. It finds destinations you can actually round-trip on a
weekend, lets you set watches that email you the moment a good option opens up, and
sends a Thursday digest of where you could go this weekend. When you find one you like,
it drops you straight into Frontier to book — your money, your call.

Under the hood it's a Next.js app on Vercel with a Python flight-data bridge, a
Postgres/Supabase backend, magic-link sign-in, and an hourly cron that does the watching
so you don't have to.

Next stop: anywhere. ✈️

#travel #sidequest #webdev #nextjs

---

## Variant C — short + punchy

Built a thing: GoWild Planner.

It watches for cheap Frontier "GoWild" weekend trips you can actually round-trip from
your home metro, emails you when one opens up, and sends a weekly Thursday digest.
Booking stays manual on Frontier.

Stack: Next.js 16 + React 19 + TypeScript, Prisma/Supabase, Resend email, an hourly
Vercel cron, and a Google-Flights-backed Python bridge running as Vercel Python
functions for real route timing.

Never miss a cheap escape again.

#buildinpublic #nextjs #vercel #supabase
