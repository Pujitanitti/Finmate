# FinMate — Performance & Scalability

## Table of Contents
- [How does FinMate perform today?](#how-does-finmate-perform-today)
- [Current bottlenecks](#current-bottlenecks)
- [Frontend performance](#frontend-performance)
- [API performance](#api-performance)
- [Database performance](#database-performance)
- [Rendering performance](#rendering-performance)
- [Growth scenarios: 100 → 1,000,000 users](#growth-scenarios-100--1000000-users)
- [When a monolith stops being sufficient](#when-a-monolith-stops-being-sufficient)

## How does FinMate perform today?

No formal load testing or Lighthouse/Web Vitals measurement has been run against this
application — any specific millisecond claim would be fabricated, so none is made here.
What *can* be stated with confidence, because it was diagnosed and fixed directly in this
codebase's history, is the navigation-performance issue below.

## Current bottlenecks

### The real fix already made: redundant per-route layouts

**The problem, as originally built:** every top-level protected route
(`dashboard`, `transactions`, `budgets`, `goals`, `accounts`, `recurring`, `insights`,
`settings`) had its own `layout.tsx`, each independently calling `requireUser()` (a
database query verifying the session and fetching the user record) and rendering its own
`<Shell>` (sidebar + topbar + theme provider). In Next.js App Router, navigating between
routes that do **not** share a layout instance unmounts the old layout and mounts a new
one — so every single navigation click was:
1. Re-running a database query to re-verify the same already-valid session.
2. Unmounting and remounting the sidebar, topbar, notification bell, and theme provider from scratch.

**The fix:** consolidated all eight sections under one shared route group,
`app/(app)/layout.tsx`, which runs the session check exactly once and renders the shell
exactly once — React Server Components then only re-render the *page* segment on
navigation, and the shell (sidebar, topbar, theme, notification bell) stays mounted the
entire time a user is in the authenticated part of the app.

This is the single most concrete, verifiable performance claim in this codebase — it can
be demonstrated by pointing to `git log`/the file structure (`app/(app)/layout.tsx` versus
what eight separate `layout.tsx` files would have looked like) rather than by an
unverifiable benchmark number.

### What is NOT yet optimized

- **`React.memo`/`useMemo` usage is still minimal** — not necessarily a problem at current component complexity, but worth stating honestly rather than claiming optimization work that wasn't done.

### Fixed in a later hardening pass (was previously listed here as a gap)

- **Client-side data caching and request deduplication** — closed via `lib/hooks/use-api-query.ts`, migrated across every dashboard widget and the Budgets/Goals/Accounts/Recurring/Insights boards. Hover-prefetching on sidebar navigation additionally warms each tab's data before the user even clicks.
- **A stale-response race condition inside the caching hook itself** — if a component's fetch `url` changed while a request for the *previous* url was still in flight (e.g. `CashFlowChart`'s date-range selector clicked quickly), the older, slower response could arrive after the newer one and silently overwrite it with stale data. Fixed by tracking the most recently *requested* url and discarding any response that doesn't match the current url when it resolves — covered by a dedicated test (`tests/useApiQuery.test.ts`) that deliberately makes the older request slower to prove the newer one wins.
- **The same class of race condition in `TransactionsTable`**, which manages its own fetch separately (search/filter/pagination made it a poor fit for the generic hook) — fixed with an incrementing request-ID guard, plus a 300ms debounce on the free-text search input so typing doesn't fire one request per keystroke.
- **Charts (Recharts) re-render on every parent re-render** — no memoization boundary
  exists between, e.g., `CashFlowChart`'s range-selector state and the chart itself, though
  Recharts' own internal rendering is reasonably efficient for the data volumes involved.

## Frontend performance

- **Bundle size:** not measured (no `next build` bundle analysis has been run and recorded). Framer Motion and Recharts are both real, non-trivial dependencies included for genuine functional reasons (animated transitions, dashboard charts) — not decorative additions.
- **Code splitting:** Next.js App Router provides automatic route-based code splitting by default; no manual `next/dynamic` lazy-loading has been added on top of that.
- **Images:** no `next/image` optimization is in use because the application currently has no user-uploaded or remote images.

## API performance

- **No caching headers** on any API response (see `SECURITY.md`/`API.md`).
- **N+1 query risk:** `services/budget.service.ts`'s `getBudgetForMonth` runs one
  `prisma.transaction.aggregate` query per budget item inside a loop (`Promise.all` over
  `budget.items.map(...)`) rather than one grouped aggregate query — functionally correct
  and parallelized via `Promise.all`, but not as efficient as a single `groupBy` query
  would be. Worth naming directly if asked "where would you optimize a specific query."
- **`services/insight.service.ts`'s `generateInsights`** runs 5 independent `Promise.all`-parallelized queries per request — reasonable, though calling `getMonthSummary` and `getSpendingByCategory` here duplicates queries already run by the dashboard's own analytics calls if both are loaded in the same page view.

## Database performance

Indexing strategy is documented in `DATABASE.md`. The two compound indexes
(`Transaction[userId, date]`, `Transaction[userId, categoryId]`) directly serve the two
highest-frequency query patterns (listing transactions, category-breakdown aggregation).
No slow-query logging or `EXPLAIN ANALYZE` output has been captured against production-like
data volumes — this would be the first concrete step before making further optimization
claims.

## Rendering performance

Server Components render the initial HTML for each page server-side, meaning the first
paint of static content (page titles, server-fetched data) does not wait on client-side
JavaScript execution. Client Components (charts, forms, interactive tables) hydrate after
that initial paint — standard Next.js App Router behavior, not a custom optimization.

## Growth scenarios: 100 → 1,000,000 users

### 100 users
No changes needed. A single Postgres instance on a free tier and a single Next.js
deployment (Vercel free tier or equivalent) comfortably handles this. This is the scale
FinMate is actually built and tested for today.

### 10,000 users
The database becomes the first thing worth watching, not the application code. Concrete,
justified changes at this point:
- **Connection pooling** (PgBouncer, or a managed provider's built-in pooler like Neon's) — serverless/edge deployments open many short-lived database connections, and Postgres has a hard connection limit.
- **Client-side data caching** (the gap named above) becomes worth fixing at this point — redundant re-fetches that are invisible at 100 users start to add real aggregate load at 10,000.
- Rate limiting (already a P0 security gap at any scale) becomes an availability concern here too — a single abusive client could meaningfully degrade shared database capacity.

**Not yet needed:** read replicas, a caching layer (Redis), background job queues,
microservices. A well-indexed single Postgres instance with connection pooling handles
10,000 users' worth of a personal-finance app's read/write pattern without needing any of
these.

### 100,000 users
This is the point where genuine architectural decomposition starts to become justified,
not just "nice to have":
- **Read replicas** for analytics queries (`getCashFlow`, `getSpendingByCategory`,
  `getMonthSummary`) — these are read-heavy, user-scoped aggregation queries that could be
  served from a replica without affecting write-path (transaction creation) latency.
- **A caching layer** (Redis) for frequently-read, infrequently-changed data — category
  lists, user preferences, the current month's budget status — becomes worth the added
  operational complexity at this point.
- **Background job processing** for the recurring-payment due-date advancement and
  notification/insight generation, which currently run synchronously as a side effect of
  a `GET` request (see `API.md`'s note on notifications/insights) — at this scale, that
  pattern should move to a scheduled job instead.

### 1,000,000 users
This is genuinely a different system, and pretending otherwise would be dishonest:
- **Database sharding or partitioning** — the `Transaction` table, growing across a
  million users with years of history each, would benefit from partitioning (e.g., by
  `userId` hash or by date range) to keep individual query and index sizes manageable.
- **A real message queue** (SQS, or similar) for asynchronous work — notification
  generation, insight computation, and recurring-payment processing all become
  legitimately queue-shaped problems at this scale, not premature abstraction.
- **CDN and edge caching** for static assets and possibly for cacheable read-only API
  responses.
- **Multi-region considerations** if the user base is geographically distributed —
  currently entirely out of scope and not designed for.

## When a monolith stops being sufficient

A monolith remains the right architecture up through the 100,000-user mark for an
application shaped like FinMate — a personal finance tool where each user's data is
independent and there is no cross-user real-time interaction (no social feed, no
matching/marketplace logic, no fan-out writes). Microservice decomposition earns its
complexity when different parts of a system have genuinely different scaling profiles or
need to be deployed/owned independently by different teams — neither is true here at any
scale this project would realistically reach. **Do not add Kafka, Kubernetes, or a
microservices split "because it looks impressive" — a good interviewer will ask "why," and
"the requirements didn't justify it yet" is the correct, defensible answer for a project of
this shape.**
