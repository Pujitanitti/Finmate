# Deploying FinMate at ₹0

FinMate is designed to run entirely on free tiers. None of the steps below
require a credit card.

## Option A — Fully local (always works)
```bash
docker compose up -d       # local Postgres
npm install
npm run db:migrate
npm run db:seed            # optional demo data
npm run dev
```

## Option B — Free cloud hosting

### Frontend/backend: Vercel (free Hobby tier)
1. Push this repo to GitHub.
2. Import the repo at vercel.com — no payment required for the Hobby tier.
3. Add environment variables from `.env.example` (`DATABASE_URL`,
   `AUTH_SECRET`, `SESSION_COOKIE_NAME`, `NEXT_PUBLIC_APP_URL`,
   `NEXT_PUBLIC_DEFAULT_CURRENCY`, `NEXT_PUBLIC_DEMO_MODE_ENABLED`).
4. Deploy.

### Database: Neon or Supabase (genuinely free Postgres tier)
1. Create a free project at neon.tech or supabase.com.
2. Copy the connection string into `DATABASE_URL` on Vercel.
3. Run `npx prisma migrate deploy` against that URL (locally, pointed at the
   cloud DB, or via a one-off CI step) to apply migrations.
4. Optionally run `npm run db:seed` once against the cloud DB for demo data.

**Note:** free-tier limits and providers change over time. If a given free
tier becomes unavailable or insufficient, FinMate keeps working with Option A
(fully local) with zero code changes — the app never depends on a paid
service to function.

## Generating a production `AUTH_SECRET`
```bash
openssl rand -base64 32
```
Never reuse the example value from `.env.example` in production.

## Post-deploy checklist
- [ ] `AUTH_SECRET` set to a unique random value (not committed to git)
- [ ] `DATABASE_URL` points at the production database
- [ ] Migrations applied (`npx prisma migrate deploy`)
- [ ] `npm run build` succeeds with no errors
- [ ] Demo mode reachable at `/register` → "Explore Demo" (if seeded)
