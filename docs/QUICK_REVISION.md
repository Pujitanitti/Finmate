# FinMate — Quick Revision Cheat Sheet

Read this in 10–15 minutes right before an interview.

## FinMate in 30 seconds

A full-stack personal finance app — accounts, transactions, budgets, savings goals,
recurring payments, and a dashboard with real analytics — built on Next.js and PostgreSQL,
with zero paid API dependencies anywhere, including a rule-based (not AI) insights engine.

## Tech stack

TypeScript · React 19 · Next.js 15 (App Router) · Tailwind CSS · Recharts · Framer Motion ·
PostgreSQL · Prisma · bcryptjs + jose (JWT) · Zod · Vitest · Playwright.

## Architecture

Monolith. Browser → Route Handlers (`app/api/**`) → Service layer (`services/*.ts`) →
Prisma → Postgres. Server Components call the service layer directly (no HTTP round trip);
Client Components call the REST API.

## Database

14 models, 7 enums, PostgreSQL via Prisma. Money stored as `Decimal(14,2)`. Compound
indexes on `Transaction[userId, date]` and `Transaction[userId, categoryId]`. Two real
`prisma.$transaction` usages: transaction↔balance sync, goal contribution↔total sync.

## Top 5 features

1. Transactions with atomic account-balance sync.
2. Budgets with live (not cached) status computed from real transaction sums.
3. Goals with contribution history and on-track projection.
4. FinMate Insights Engine — fully rule-based, no paid AI.
5. Financial Health Score — transparent, weighted, per-factor breakdown shown in UI.

## Top 5 engineering challenges

1. **Navigation performance bug** — 8 separate layouts remounting the shell + re-running auth on every click; fixed via one shared route-group layout.
2. Keeping business logic out of route handlers — the service-layer boundary.
3. Atomic balance updates via `prisma.$transaction`.
4. Live budget-status computation from real aggregates instead of a cache that could drift.
5. Choosing rule-based insights over an AI API for explainability and cost.

## Top 10 technical decisions

1. Next.js monolith, not separate frontend/backend.
2. PostgreSQL, not MongoDB — relational integrity for financial data.
3. Prisma, not raw SQL.
4. Hand-rolled bcrypt+JWT auth, not NextAuth/Clerk.
5. No global state library — local `useState`+`fetch` per component.
6. REST, not GraphQL/tRPC.
7. Tailwind CSS with CSS-variable theming.
8. Rule-based Insights Engine, not an AI API.
9. `Decimal(14,2)` for all monetary columns.
10. Shared route-group layout (fixed mid-project, a real diagnosed bug).

## Top 20 interview questions + short answers

1. **What is FinMate?** Full-stack personal finance app, zero-cost infrastructure.
2. **Architecture?** Route Handlers → Services → Prisma → Postgres.
3. **Why Postgres?** Relational integrity + `Decimal` for money.
4. **Why no AI for insights?** Cost + explainability + trust for a financial product.
5. **Auth mechanism?** bcrypt + JWT in an HttpOnly cookie, edge middleware guards routes.
6. **Biggest bug found & fixed?** Redundant per-route layouts causing slow navigation.
7. **How is money kept precise?** `Decimal(14,2)` storage — but see the honest gap below.
8. **Biggest known precision gap?** Some service-layer arithmetic converts `Decimal`→`number` before computing, reintroducing float risk in the calculation step.
9. **How are transactions kept atomic?** `prisma.$transaction` for txn↔balance and contribution↔goal-total writes.
10. **Biggest security gap?** No rate limiting anywhere — login is brute-forceable today.
11. **How is user data isolated?** Every service query scoped by session-derived `userId`; ownership re-verified before every mutation.
12. **Test coverage?** 4 Vitest files on pure business logic + 1 Playwright E2E flow. No API or component tests yet.
13. **State management?** None — local `useState`+`fetch`, a deliberate trade-off, biggest frontend gap.
14. **How would you scale to 100K users?** Connection pooling, client-side caching, read replicas for analytics.
15. **Would you add microservices?** No — nothing here has a genuinely different scaling profile; would be complexity for appearance.
16. **How does budget status get computed?** Live `SUM()` against real transactions, not a cached counter.
17. **Biggest schema inconsistency?** `RecurringPayment.categoryName` is a string, not a proper `Category` FK — an oversight, not a design choice.
18. **What race condition exists today?** Concurrent goal contributions could lose an update (read-then-write, not atomic increment).
19. **How would you fix that race condition?** Prisma's `{ increment: amount }` — pushes the add into one atomic SQL statement.
20. **What's the #1 thing you'd fix with one more week?** Already done this round — see below; next up is error monitoring.

## Biggest weakness (remaining)

No error monitoring/observability, and no CSRF token beyond `SameSite=Lax`. The
previous top weakness — no rate limiting — is now fixed (see below).

## Biggest strength

Two things, now both true: the service-layer separation (every route handler is thin,
every business rule is independently testable), **and** a demonstrated hardening pass
that found and fixed a real race condition, closed the two biggest security gaps, and
proved it with real integration tests — not just claimed it in documentation.

## Biggest scalability concern (remaining)

Client-side caching now covers the 5 highest-traffic dashboard components (fixed via a
custom `useApiQuery` hook), but the transactions table and the board components
(budgets/goals/accounts/recurring) still use the original independent-fetch pattern —
lower priority since they're not re-fetched as frequently as dashboard widgets, but still
a partial gap, not a fully closed one.

## Biggest security concern (remaining)

No error monitoring — a production failure would be invisible without manually checking
logs. Rate limiting and session revocation, the two previous top concerns, are now fixed.

## What was fixed this round (all real code, verified by tests)

Rate limiting (login/register), session revocation (`sessionVersion`), the goal-
contribution race condition (atomic increment), the `RecurringPayment.categoryName`
schema fix, security headers, pagination on notifications/insights, and client-side
caching for the dashboard's highest-traffic components. See `PROJECT_AUDIT.md`'s "What
moved, concretely" for the exact files.

## What I would improve next

In order: error monitoring + a React error boundary (P1), a CSRF token (P1), extend
caching to the remaining board components, direct HTTP-layer route tests to complement
the new integration tests, component tests for the highest-traffic UI (P2).

## 10 facts I MUST remember

1. 14 Prisma models, 7 enums — `RecurringPayment` now has a proper `categoryId` FK (fixed from a denormalized string).
2. 26 API routes, all following verify→validate→delegate→respond.
3. `GET /api/transactions`, `GET /api/notifications`, and `GET /api/insights` all paginate now; the rest are deliberately left unpaginated (naturally small, bounded collections).
4. Money is `Decimal(14,2)` in the DB. The one real precision/race risk found (`goal.service.ts`'s read-then-write) is now fixed with an atomic `{ increment }`.
5. Three real `prisma.$transaction`/atomic-increment usages: transaction↔balance, contribution↔goal (now atomic), and the account balance adjustment (which was already atomic on closer audit).
6. The Insights Engine and Financial Health Score are both 100% rule-based/pure-function, fully unit-tested.
7. Auth: bcrypt (cost 12) + `jose`-signed JWT in an HttpOnly, SameSite=Lax cookie — now with real session revocation via `sessionVersion`.
8. The navigation-performance fix: 8 layouts → 1 shared `app/(app)/layout.tsx`. The redundant-fetch fix: a custom `useApiQuery` caching hook, not TanStack Query.
9. Rate limiting and security headers are both real and implemented — `lib/security/rate-limit.ts` and `next.config.js`. Still gaps: no CSRF token, no error monitoring.
10. 6 Vitest unit-test files + 3 real-database integration tests (including a concurrency test) + 1 Playwright E2E spec. No component tests yet.
