# FinMate

**A full-stack personal finance management platform, built at zero cost.**

Track income and expenses, manage multiple accounts, set category budgets, work toward
savings goals, monitor recurring payments, and get transparent, rule-based financial
insights — no paid APIs required to run any of it.

[Live demo](#) · [Report a bug](#) · [Documentation](./docs)

---

## Table of Contents

- [Problem statement](#problem-statement)
- [Why FinMate exists](#why-finmate-exists)
- [Key features](#key-features)
- [Screenshots](#screenshots)
- [Tech stack](#tech-stack)
- [Architecture overview](#architecture-overview)
- [Application flow](#application-flow)
- [Folder structure](#folder-structure)
- [Database design](#database-design)
- [API overview](#api-overview)
- [Authentication & authorization](#authentication--authorization)
- [Security considerations](#security-considerations)
- [Error handling](#error-handling)
- [Performance considerations](#performance-considerations)
- [Responsive design](#responsive-design)
- [Accessibility](#accessibility)
- [Testing](#testing)
- [Installation](#installation)
- [Environment variables](#environment-variables)
- [Local development](#local-development)
- [Production deployment](#production-deployment)
- [Future improvements](#future-improvements)
- [Engineering challenges](#engineering-challenges)
- [Key technical decisions](#key-technical-decisions)
- [Lessons learned](#lessons-learned)
- [Project limitations](#project-limitations)
- [License](#license)

---

## Problem statement

Most people can answer "how much did I spend last month?" only approximately. Free
budgeting tools either require linking a bank account to a third party, lock core features
behind a subscription, or are so minimal they amount to a spreadsheet with a login screen.

## Why FinMate exists

FinMate was built to answer one question honestly: **can a genuinely useful personal
finance tool be built and run at ₹0 — no paid database, no paid AI API, no paid auth
provider, no paid hosting requirement?** Every technology choice in this repository was
made under that constraint, documented in [`docs/ENGINEERING_DECISIONS.md`](./docs/ENGINEERING_DECISIONS.md).

## Key features

All of the following are implemented and backed by real database queries — none of this
list is aspirational (see [Project limitations](#project-limitations) for what is *not*
implemented).

- **Authentication** — email/password registration and login, bcrypt password hashing, signed JWT session cookies, protected routes via edge middleware.
- **Multi-account tracking** — bank, savings, cash, credit card, and investment accounts, each with a running balance kept in sync by every transaction.
- **Transactions** — full CRUD, search, filter by category/account/type, sort, and pagination. Creating/editing/deleting a transaction atomically updates the owning account's balance inside a database transaction.
- **Automatic categorization** — a local, deterministic merchant-name matcher (`services/categorization.service.ts`) suggests a category (e.g., "Swiggy" → Food); the user can always override it. No external API call is involved.
- **Budgets** — per-category monthly limits with live status (`Healthy` / `Warning` / `Exceeded`) computed from real transaction sums, not stored counters.
- **Savings goals** — target amount, optional target date, contribution history, and an on-track projection based on recent contribution rate.
- **Recurring payments** — track subscriptions/bills with frequency and next-due-date.
- **FinMate Insights Engine** — a dedicated, fully rule-based service (`services/insight.service.ts`) that reads real transaction/budget/goal aggregates and generates observations like "Your Food spending increased by 18% this month." No OpenAI/Claude/Gemini or any paid AI API is used or required.
- **Financial Health Score** — a transparent, weighted 0–100 score (`services/financialHealth.service.ts`) combining savings rate, budget adherence, spending consistency, goal progress, and recurring-expense ratio, with a visible per-factor breakdown.
- **Notifications** — in-app notifications generated from real state (budget warnings, upcoming recurring payments).
- **Dashboard analytics** — cash flow over selectable time ranges, spending-by-category breakdown, month-over-month comparisons — all computed from live database aggregates.
- **Dark mode** — full light/dark theme support via CSS custom properties.
- **Demo mode** — a seed script (`prisma/seed.ts`) populates a realistic demo account (5 accounts, 40+ transactions, budgets, goals, recurring payments, notifications) for evaluation without manual data entry.

## Screenshots

> Add screenshots here before publishing: `docs/screenshots/dashboard.png`,
> `docs/screenshots/transactions.png`, `docs/screenshots/budgets.png`,
> `docs/screenshots/goals.png`, `docs/screenshots/insights.png`, `docs/screenshots/mobile.png`.
> Not currently implemented — placeholder only.

## Tech stack

| Layer | Technology | Why |
|---|---|---|
| Frontend | React 19, Next.js 15 (App Router), TypeScript | Server Components reduce client JS; one framework for UI + API. |
| Styling | Tailwind CSS, CSS custom properties for theming | Utility-first, no runtime CSS-in-JS cost, easy dark-mode support. |
| Charts | Recharts | Declarative, composable, good enough for dashboard-scale data volumes. |
| Forms/validation | React Hook Form, Zod | Client and server share the same Zod schemas for consistent validation. |
| Animation | Framer Motion | Used deliberately (page transitions, active-tab indicators), not decoratively. |
| Backend | Next.js Route Handlers, Node.js | Colocated with the frontend; no separate service to deploy or version for this scale. |
| Database | PostgreSQL | Real relational integrity for financial data (foreign keys, transactions), genuinely free local/hosted tiers. |
| ORM | Prisma | Type-safe queries, migrations, and `Decimal` support for monetary columns. |
| Auth | bcryptjs + `jose` (JWT) + HttpOnly cookies | No third-party auth provider dependency; full control over the session model. |
| Testing | Vitest, React Testing Library, Playwright | Unit tests for business logic, E2E for the core user flow. |
| Tooling | ESLint, Prettier | Consistent code style, enforced in CI. |

Full reasoning for each choice, including alternatives considered, is in
[`docs/ENGINEERING_DECISIONS.md`](./docs/ENGINEERING_DECISIONS.md).

## Architecture overview

FinMate is a single Next.js application acting as both frontend and backend — a
**monolith by design**, not by accident. See [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)
for full diagrams and the request lifecycle.

```
Browser (React Server + Client Components)
        │
        ▼
Next.js Route Handlers  (app/api/**/route.ts)
        │  — Zod validation, session check
        ▼
Service layer            (services/*.ts)
        │  — business logic, ownership checks, calculations
        ▼
Prisma Client
        │
        ▼
PostgreSQL
```

## Application flow

1. A visitor lands on the marketing page (`app/page.tsx`) and registers (`app/(auth)/register`).
2. Registration hashes the password, creates the user with default categories, and issues a signed session cookie.
3. A 4-step onboarding flow (`app/onboarding`) collects monthly income, goals, and currency.
4. All protected routes live under a single shared layout (`app/(app)/layout.tsx`) which verifies the session once and renders the persistent sidebar/topbar shell around whichever page is active.
5. Each page is a React Server Component that queries the database directly through the service layer; interactive pieces (forms, charts, tables) are Client Components that call the REST API routes.

## Folder structure

```
finmate/
├── app/
│   ├── (app)/            # All authenticated sections share ONE layout (see docs/ARCHITECTURE.md)
│   │   ├── dashboard/  budgets/  goals/  accounts/  recurring/  insights/  settings/  transactions/
│   │   └── layout.tsx     # Single session check + Shell for all of the above
│   ├── (auth)/            # login, register — public
│   ├── onboarding/
│   ├── api/               # Route Handlers, one folder per resource
│   └── page.tsx            # Public marketing landing page
├── components/
│   ├── ui/                 # Design-system primitives (Button, Card, Input, Skeleton, EmptyState...)
│   ├── layout/              # Shell, Sidebar, Topbar, ThemeProvider, Toast system
│   ├── brand/                # Logo mark + wordmark
│   ├── dashboard/ transactions/ budgets/ goals/ accounts/ recurring/ insights/ settings/ charts/
├── lib/
│   ├── auth/                 # password hashing, JWT session, route guards
│   ├── db/                    # Prisma client singleton
│   ├── validation/             # Zod schemas, one per resource
│   └── utils/                   # formatting, category icon map, cn() helper
├── services/                     # Business logic — the layer API routes call into
├── prisma/
│   ├── schema.prisma               # Full data model
│   └── seed.ts                      # Demo data generator
├── tests/                             # Vitest unit tests + Playwright E2E
└── docs/                                # This documentation set
```

## Database design

PostgreSQL via Prisma, 14 models, fully normalized. Full field-by-field documentation,
indexing rationale, and the honest floating-point/Decimal precision discussion are in
[`docs/DATABASE.md`](./docs/DATABASE.md).

## API overview

26 Route Handler files covering auth, transactions, accounts, budgets, goals, recurring
payments, notifications, insights, analytics, and settings. Full request/response
documentation with real examples is in [`docs/API.md`](./docs/API.md).

## Authentication & authorization

- Passwords hashed with `bcryptjs` (cost factor 12) — never stored in plain text.
- Sessions are signed JWTs (`jose`, HS256) stored in an `HttpOnly`, `SameSite=Lax` cookie — inaccessible to client-side JavaScript.
- Edge middleware (`middleware.ts`) verifies the session token before allowing access to any protected route, redirecting to `/login` otherwise.
- Every service function that touches user data is scoped by `userId` taken from the verified session, and mutations re-check ownership with `findFirstOrThrow({ where: { id, userId } })` before writing — one user cannot read or modify another user's data even by guessing IDs.
- **Current gap:** no refresh-token rotation and no server-side session revocation list — see [`docs/SECURITY.md`](./docs/SECURITY.md) for the honest breakdown.

## Security considerations

See [`docs/SECURITY.md`](./docs/SECURITY.md) for the full, unfiltered analysis, including
explicitly labeled current gaps (no rate limiting, no CSRF token, no security headers) and
how each should be fixed.

## Error handling

API routes return `{ error: string }` with an appropriate HTTP status code on failure; Zod
validates every request body server-side before it reaches the service layer.
**Not currently implemented — planned improvement:** React error boundaries, centralized
client-side error logging, and a consistent error-response envelope across all routes.

## Performance considerations

The most significant real fix in this codebase: every top-level protected route originally
had its own `layout.tsx`, each independently re-running the session database query and
remounting the entire sidebar/theme provider on every navigation. Consolidating all
protected routes under one shared route-group layout (`app/(app)/layout.tsx`) removed that
redundant work. Full details, plus what is *not* yet optimized (no client-side caching, no
request deduplication), are in [`docs/PERFORMANCE.md`](./docs/PERFORMANCE.md).

## Responsive design

Sidebar navigation on desktop/tablet, a bottom tab bar on mobile (`components/layout/mobile-nav.tsx`), and Tailwind responsive utility classes throughout. Manually verified across common breakpoints; no automated responsive/visual-regression testing exists.

## Accessibility

Semantic HTML and labeled form inputs are used throughout. **Not currently implemented —
planned improvement:** `aria-live` announcements for toast notifications, a documented
keyboard-navigation pass, and a color-contrast audit.

## Testing

- 4 Vitest suites covering pure business logic: budget status thresholds, goal progress/on-track projection, the Financial Health score, and the categorization engine.
- 1 Playwright E2E spec covering the core flow: register → onboarding → create account → add transaction → create budget → create goal → verify dashboard analytics.
- **Not currently implemented — planned improvement:** API route tests, React component tests, and CI-tracked coverage reporting. See [`docs/TESTING.md`](./docs/TESTING.md) for a prioritized test plan.

## Installation

### Prerequisites
- Node.js ≥ 20
- PostgreSQL (locally via Docker, or installed directly)
- Git

```bash
git clone <your-repo-url>
cd finmate
npm install
```

## Environment variables

Copy `.env.example` to `.env` and fill in values — every variable has a genuinely free
default, no paid service is ever required:

```env
DATABASE_URL="postgresql://finmate:finmate@localhost:5432/finmate?schema=public"
AUTH_SECRET="generate-with-openssl-rand--base64-32"
SESSION_COOKIE_NAME="finmate_session"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_DEFAULT_CURRENCY="INR"
NEXT_PUBLIC_DEMO_MODE_ENABLED="true"
```

## Local development

> **Upgrading an existing local database?** This codebase includes a hardening pass with
> two real schema changes (session revocation, a `RecurringPayment` foreign-key fix). See
> [`MIGRATION_NOTES.md`](./MIGRATION_NOTES.md) before running `npm run db:migrate` if you
> already had FinMate running against a database from before this pass.

```bash
docker compose up -d       # starts local Postgres
cp .env.example .env       # then set AUTH_SECRET
npm run db:migrate          # applies the Prisma schema
npm run db:seed              # optional — loads demo@finmate.app / DemoPass123
npm run dev
```

```bash
npm run lint             # ESLint
npm test                 # Vitest unit tests (fast, no database required)
npm run test:integration # Real-database integration tests — auth, cross-user ownership isolation, concurrency (requires a running, migrated Postgres)
npm run test:e2e         # Playwright E2E (requires the dev server + a migrated DB)
npm run build              # production build
```

## Production deployment

See [`docs/ARCHITECTURE.md#deployment-architecture`](./docs/ARCHITECTURE.md#deployment-architecture)
and the project's `DEPLOYMENT.md` for the free-tier deployment path (Vercel + a free-tier
managed Postgres provider such as Neon or Supabase).

## Future improvements

See [`docs/ROADMAP.md`](./docs/ROADMAP.md) for the full, prioritized list. Highest-priority
items: rate limiting on auth endpoints, API-level test coverage, security headers, and a
session-revocation mechanism.

## Engineering challenges

The primary real challenge documented in this repository was a navigation-performance
regression traced to redundant per-route layouts (see [Performance considerations](#performance-considerations)
above). Full write-up, including the diagnosis process, is in
[`docs/ENGINEERING_DECISIONS.md`](./docs/ENGINEERING_DECISIONS.md) and
[`docs/INTERVIEW_PREP.md`](./docs/INTERVIEW_PREP.md).

## Key technical decisions

See [`docs/ENGINEERING_DECISIONS.md`](./docs/ENGINEERING_DECISIONS.md) for every major
decision (framework, database, auth mechanism, styling approach, deployment) documented in
Decision/Context/Options/Trade-offs format.

## Lessons learned

- A shared layout is not just a DRY convenience in Next.js App Router — it directly determines what gets remounted (and re-fetched) on every navigation. This was learned by tracing an actual user-reported slowness, not from documentation.
- Storing money as `Decimal` in the database is only half the correctness story; converting to JS `number` for arithmetic anywhere in the service layer reintroduces the exact floating-point risk `Decimal` was meant to avoid (see `DATABASE.md`).
- A rule-based "insights engine" that is honestly labeled as rule-based is a legitimate, defensible feature — it does not need to pretend to be AI to be useful, and being upfront about that in the UI (see `app/(app)/insights/page.tsx`) is itself a product decision worth being able to explain.

## Project limitations

Stated plainly, for anyone evaluating this project or an interviewer asking "what doesn't
it do":

- No bank account linking (Plaid or equivalent) — all data is entered manually by design (zero-cost constraint).
- No rate limiting, CSRF token, or security headers — not production-safe with real financial data yet.
- No caching layer — every page navigation and dashboard widget re-fetches from the database.
- No multi-currency conversion — a single currency is stored per user, not converted between currencies.
- No mobile app — responsive web only.
- No automated component or API-level tests — only business-logic unit tests and one E2E flow.

## License

MIT — this is a personal portfolio project.
