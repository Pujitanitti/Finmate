# Migration Notes — Hardening Pass

This document covers the one manual step required after pulling the security/correctness
hardening pass (rate limiting, session revocation, the `RecurringPayment` schema fix,
client-side caching) into a project that was already running against a database on the
previous schema.

## Required: run a new Prisma migration

Two schema changes were made in `prisma/schema.prisma`:

1. **`User.sessionVersion`** (new `Int @default(0)` column) — required for session
   revocation (see `docs/SECURITY.md`'s Session/token handling section).
2. **`RecurringPayment.categoryName` → `RecurringPayment.categoryId`** — the free-text
   category string was replaced with a proper foreign key to `Category` (see
   `docs/DATABASE_INTERVIEW.md` Q8 and `docs/ROADMAP.md` item 8).

After pulling this code, run:

```bash
npx prisma migrate dev --name session-revocation-and-recurring-category-fk
```

This will:
- Add the `sessionVersion` column to `User`, defaulting existing rows to `0` — every
  currently-logged-in user's existing session cookie will continue to work (their JWT was
  issued before `sessionVersion` existed, and `getSession()` treats a missing
  `sessionVersion` in the token as `0`, matching the column default — see the comment in
  `lib/auth/session.ts`).
- Change `RecurringPayment.categoryName` (String) to `RecurringPayment.categoryId` (String,
  nullable, FK to `Category`). **This is a breaking schema change for existing data** — any
  `RecurringPayment` rows already in your database will have their old `categoryName`
  value dropped; Prisma's interactive migration flow will ask how to handle the column
  change. For a fresh local setup (the common case, and what `docker-compose.yml` +
  `npm run db:seed` produces), this doesn't matter — `prisma/seed.ts` was updated to use
  `categoryId` correctly. **If you have real existing recurring-payment data you want to
  preserve**, write a one-off data migration script that matches each row's old
  `categoryName` string against that user's existing `Category.name` values and populates
  `categoryId` before dropping the old column, rather than accepting Prisma's default
  data-loss prompt.

## If you're on a fresh database (recommended path)

If you haven't run `npm run db:migrate` yet at all, none of the above applies — just run
the normal setup:

```bash
docker compose up -d
cp .env.example .env   # set AUTH_SECRET
npm run db:migrate
npm run db:seed
npm run dev
```

The schema and seed script are already fully consistent with each other; this file exists
specifically for the case of upgrading a database that was migrated *before* this
hardening pass.
