# FinMate — Interview Preparation (Single Source of Truth)

Read this one document before any interview involving this project.

## Table of Contents
- [A. 30-second explanation](#a-30-second-explanation)
- [B. 1-minute explanation](#b-1-minute-explanation)
- [C. 3-minute deep explanation](#c-3-minute-deep-explanation)
- [50+ Project Questions](#50-project-questions)

---

## A. 30-second explanation

> "FinMate is a full-stack personal finance app I built — think budgeting and expense
> tracking, but with everything running on genuinely free infrastructure: PostgreSQL,
> Next.js, no paid APIs anywhere, including a rule-based insights engine instead of a paid
> AI API. It's got real auth, a proper relational schema with foreign-key integrity, and a
> service layer that keeps business logic out of the API routes. The most concrete thing I
> can point to is a real performance bug I found and fixed — navigation was slow because
> every page had its own layout re-running the auth check on every click; I consolidated
> them into one shared layout and fixed it."

## B. 1-minute explanation

> "FinMate is a personal finance management platform — accounts, transactions, budgets,
> savings goals, recurring payments, and a dashboard with real analytics. I built it
> end-to-end on Next.js 15's App Router, so the frontend and API live in one repo — Route
> Handlers call into a service layer, which is the only thing that talks to Prisma and
> Postgres. That separation matters because it means the business logic — like how a
> transaction atomically updates an account's balance inside a database transaction, or
> how a budget's status is computed live from real transaction sums rather than a cached
> counter — is testable in isolation and not tangled into HTTP handling.
>
> The feature I'm most willing to defend under questioning is the Insights Engine — it's
> deliberately rule-based, not an AI API call, because for a financial product I wanted
> every generated insight to be traceable to an exact rule and exact data, not a
> black-box language model guess. I also found and fixed a real performance issue: every
> section originally had its own layout component, so switching tabs was re-running the
> session-verification database query and remounting the whole UI shell every single
> click. Consolidating that into one shared layout was the single highest-impact fix I
> made to the whole app.
>
> I'm upfront that it has real gaps too — no rate limiting yet, no session revocation,
> thin test coverage beyond the core financial calculation logic — all documented
> explicitly rather than hidden, because I'd rather be able to answer 'what's missing and
> why' honestly than pretend it's finished."

## C. 3-minute deep explanation

**Problem:** most free budgeting tools either require linking a bank account to a
third-party aggregator, gate core features behind a paywall, or are so minimal they're
barely more than a spreadsheet. I wanted to build something genuinely useful that could run
at zero cost end-to-end — not a demo with fake data, a real working application.

**Solution:** FinMate — manual account/transaction tracking (by design, not linked to
banks, which keeps it free and avoids a real security liability), category budgets with
live status, savings goals with contribution tracking and an on-track projection, recurring
payment tracking, and a dashboard with cash-flow and category-breakdown analytics computed
from live database aggregates, not cached snapshots.

**Architecture:** a Next.js 15 App Router monolith — Server Components for pages that
fetch their own data server-side, Client Components for anything interactive, Route
Handlers as the API surface, and a service layer (`services/*.ts`) that is the only code
allowed to talk to Prisma. That last boundary is the one I'd defend hardest in an
interview: every route handler is thin — verify session, validate with Zod, call a
service function, return JSON — and every actual business rule (how a budget's status is
computed, how a goal's on-track projection works, how a transaction's creation atomically
adjusts an account balance) lives in a service function that's independently testable and
has zero knowledge of HTTP.

**Technologies:** TypeScript throughout; PostgreSQL via Prisma for real relational
integrity on financial data (foreign keys, `Decimal` columns for money, not floats);
bcrypt + signed JWT cookies for auth, hand-rolled rather than a third-party provider, so I
have full control over and full understanding of the session model; Tailwind CSS with CSS
custom properties for a genuinely working light/dark theme; Recharts for the dashboard
visualizations; Vitest for unit tests on the pure business-logic functions, Playwright for
one real end-to-end flow.

**Key features:** the Financial Health Score is the one I'd lead with — a transparent,
weighted 0–100 score combining savings rate, budget adherence, spending consistency, goal
progress, and recurring-expense ratio, with every point's contribution visible in the UI,
not just a mystery number. The Insights Engine is the second — fully rule-based, explicitly
labeled as such in the product, generating things like "your Food spending increased 18%
this month" directly from real transaction aggregates.

**Engineering challenges:** the concrete one is the navigation-performance bug — I noticed
tab switching felt slow, traced it to eight separate per-section `layout.tsx` files each
independently re-verifying the session and remounting the entire sidebar/topbar/theme
provider on every click, and fixed it by consolidating everything under one shared
route-group layout. That's the kind of bug that's easy to paper over with a loading
spinner and I specifically didn't do that — I found the actual cause.

**Trade-offs:** I chose no global state library and no client-side data-fetching cache
(no React Query) — which was the right call for keeping the codebase simple at this scope,
but it's also the most honest gap: eleven different components independently fetch their
own data with zero deduplication, so navigating back to the dashboard re-fetches
everything from scratch every time. I know exactly how I'd fix it (TanStack Query, not a
heavier global store) and why I haven't yet (time, and it wasn't the highest-priority gap
relative to security and testing).

**Results:** a fully working application — register, log in, track real accounts and
transactions with atomic balance updates, set budgets, track goals, and see analytics
computed from live data, not fixtures. I don't have production usage metrics to cite
because it hasn't been deployed with real users, and I won't invent a number that isn't
real.

---

## 50+ Project Questions

Each answer follows: **Concise answer** → *Deeper explanation* → possible follow-ups.

### 1. What is FinMate?
**A full-stack personal finance management app — accounts, transactions, budgets, goals, recurring payments, and analytics, built on Next.js and PostgreSQL at zero infrastructure cost.**
*It's a monolith: one Next.js App Router application serving both the UI and the API, backed by a normalized Postgres schema via Prisma.*
Follow-ups: "What does 'zero cost' actually mean here?" → every dependency has a genuinely free tier or is open-source; no paid API keys are required to run any feature.

### 2. Why did you build it?
**To have a genuinely complete, working full-stack project I could speak to in depth — not a tutorial clone.**
*I wanted every claim I make about it in an interview to be checkable against real code, which is why the documentation set explicitly labels gaps instead of hiding them.*

### 3. What problem does it solve?
**Free budgeting tools are either tied to bank-linking third parties, paywalled, or too minimal to be useful.**
*FinMate trades bank-linking convenience for zero cost and manual control over your own data entry.*
Follow-up: "Why not use Plaid?" → Plaid's meaningful tiers aren't free at scale, and it was explicitly out of scope for a zero-cost constraint.

### 4. What was your role?
**Sole developer — architecture, schema, API, frontend, and this documentation set.**

### 5. What is the architecture?
**Next.js App Router monolith: Route Handlers → Service layer → Prisma → PostgreSQL.**
*See `ARCHITECTURE.md` for the full diagram. The service layer is the key boundary — it's the only code that imports Prisma.*

### 6. Why did you choose this tech stack?
**TypeScript end-to-end, Next.js for one deployable unit, Postgres for relational integrity on financial data.**
*Full reasoning with alternatives considered is in `ENGINEERING_DECISIONS.md`.*

### 7. Why this database?
**PostgreSQL — foreign-key constraints and multi-table transactions are first-class, and `Decimal` is the correct type for money.**
*A document store would push referential integrity entirely into application code with no database-level safety net.*

### 8. How does authentication work?
**Register/login hash the password with bcrypt (cost 12) and issue a signed JWT in an HttpOnly cookie; edge middleware verifies it on every protected route.**
*See the sequence diagram in `ARCHITECTURE.md`. The JWT contains only `userId` and `email` — no sensitive data.*
Follow-up: "What happens on logout?" → the cookie is deleted client-side; the JWT itself is not server-side revoked (a known gap, see `SECURITY.md`).

### 9. How does authorization work?
**Every service function scopes its queries by the authenticated user's ID, and mutations re-verify ownership before writing.**
*Concretely: `prisma.transaction.findFirstOrThrow({ where: { id, userId } })` before any update/delete — `userId` always comes from the verified session, never from client input.*

### 10. How does data flow through the application?
**Server Components fetch data directly via the service layer during render; Client Components call the REST API, which calls the same service layer.**
*Two paths into the same business logic — see the data-flow diagram in `ARCHITECTURE.md`.*

### 11. What was the hardest part?
**Diagnosing the real cause of slow tab navigation rather than papering over it with a loading spinner.**
*It took tracing the actual React component tree to realize eight separate layouts were each remounting the shell on every click — see `PERFORMANCE.md`.*

### 12. What was the biggest bug?
**The navigation-performance issue above.** *There wasn't a data-corruption bug found in this codebase to date — the biggest issue was architectural/performance, not correctness.*

### 13. How did you debug it?
**Traced which components were unmounting/remounting on navigation by inspecting the route structure, then confirmed the fix by consolidating the layouts.**

### 14. How did you handle errors?
**Zod validation returns 400 with a specific message; unexpected errors are caught and return a generic message with a server-side `console.error`.**
*Honest gap: no centralized error monitoring exists yet — see `SECURITY.md`'s Logging section.*

### 15. How do you validate user input?
**Zod schemas in `lib/validation/*.ts`, one per resource, enforced server-side on every mutating route.**
*The same schemas back client-side form hints where wired up, so validation rules can't drift between client and server.*

### 16. How do you protect user data?
**Password hashing, HttpOnly session cookies, and per-query ownership scoping — see `SECURITY.md`'s User Data Isolation section for the exact mechanism.**

### 17. How would you scale this?
**Connection pooling and client-side caching first (10K users), read replicas and background jobs next (100K users), sharding/queues only at genuine million-user scale.**
*Full breakdown in `PERFORMANCE.md` — I'm explicit about what's NOT needed at each stage too, not just what is.*

### 18. What happens when the database goes down?
**Currently: every request fails with an unhandled error — there's no circuit breaker, retry logic, or graceful degradation.**
*Honest gap — this is the kind of resilience work that would be added before any real production deployment.*

### 19. What happens when the API is unavailable?
**Client components show their existing loading state indefinitely — there's no client-side retry or offline handling implemented.**

### 20. How would you optimize the frontend?
**Add TanStack Query for request deduplication and caching — the single highest-value frontend change available.**
*Right now 11 components independently fetch on mount with zero sharing.*

### 21. How would you optimize the database?
**Convert `budget.service.ts`'s per-item aggregate loop into a single `groupBy` query — currently N queries where 1 would do.**

### 22. Where would you add caching?
**Read-heavy, rarely-changing data first: category lists, user preferences. Then analytics aggregates with short TTLs.**

### 23. How would you implement rate limiting?
**A token-bucket limiter, keyed by IP, applied first to `/api/auth/login` and `/api/auth/register` via middleware.**
*Currently the single biggest unaddressed security gap — see `SECURITY.md`.*

### 24. How would you handle concurrent transactions?
**Currently relying on Postgres's default `READ COMMITTED` isolation inside `prisma.$transaction` — no explicit row locking or optimistic concurrency control yet.**
*See `DATABASE.md`'s Transaction Consistency section and `SYSTEM_DESIGN.md` for how I'd harden this.*

### 25. How would you prevent duplicate transactions?
**Currently not prevented — a double-click on "Add Transaction" before the request completes would create two rows.**
*Fix: disable the submit button during the request (partially done via a `saving` state) and/or an idempotency key on the client.*

### 26. How would you handle financial precision?
**`Decimal(14,2)` at the storage layer — but I found and documented a real gap: some service-layer arithmetic converts to JS `number` before computing, which reintroduces float imprecision in the calculation step even though storage is exact.**
*This is the single most important "gotcha" I'd volunteer proactively — see `DATABASE.md`.*

### 27. What happens if two requests modify the same data simultaneously?
**Whichever transaction commits last wins — no optimistic locking exists to detect or reject a conflicting concurrent write.**

### 28. How would you design this for 1 million users?
**See `SYSTEM_DESIGN.md` — read replicas, a real message queue for background work, and likely partitioning the Transaction table by user or date.**

### 29. What would you change if you rebuilt it?
**Start with TanStack Query from day one instead of retrofitting it, and write API-level tests alongside each route as it's built rather than after.**

### 30. What are the biggest limitations?
**No bank linking (by design), no rate limiting, no session revocation, thin test coverage beyond core financial logic — all listed explicitly in the README's Project Limitations section.**

### 31. Why Next.js over a separate React + Express setup?
**No independent scaling/deployment need existed to justify the network boundary and duplicated types a separate backend would require.**

### 32. Why Prisma over raw SQL?
**Type safety generated directly from schema, and a workable migration flow — at the cost of some query flexibility for complex aggregates (see `budget.service.ts`'s known inefficiency).**

### 33. Why did you build your own auth instead of using NextAuth/Clerk?
**Full control and understanding of the exact session model, zero external dependency risk — traded off against having to build session revocation myself (not yet done).**

### 34. Explain the account balance update logic.
**Creating, editing, or deleting a transaction runs inside `prisma.$transaction`, atomically updating both the transaction row and the owning account's `balance` column — so the two can never go out of sync from a partial failure.**

### 35. How does the Financial Health Score work?
**A weighted sum of five factors (savings rate 30%, budget adherence 25%, spending consistency 15%, goal progress 15%, recurring-expense ratio 15%), each independently unit-tested, with every point's contribution shown in the UI.**

### 36. How does the Insights Engine work, and why isn't it AI?
**Deterministic rules evaluated against real transaction/budget/goal aggregates — deliberately not an AI API call, so every insight is explainable and there's zero risk of a hallucinated financial claim.**

### 37. How does the budget status (Healthy/Warning/Exceeded) get computed?
**Live, on every read — `SUM(amount)` against real transactions for that category/month, compared to the stored limit. Not a cached counter that could silently drift from reality.**

### 38. Walk me through what happens when a user adds a transaction.
**Client submits → Zod validates → `createTransaction` runs inside a DB transaction, creating the row and adjusting the account balance atomically → response returned → client re-fetches the list.**

### 39. How is the sidebar/topbar kept mounted across navigation?
**All eight authenticated sections share one `app/(app)/layout.tsx` via a Next.js route group — this was a deliberate fix for a real performance bug, not the original structure.**

### 40. What's your test coverage like, honestly?
**Four Vitest files covering pure business-logic functions (budget status, goal progress, financial health, categorization), plus one Playwright E2E flow. No API-route or component tests yet — a real, named gap.**

### 41. How do you know your financial health score calculation is correct?
**It's unit tested for exact boundary values (a perfect profile scores exactly 100, worst-case scores exactly 0) and for the invariant that all breakdown contributions sum to the total.**

### 42. What would a load test likely reveal first?
**Almost certainly the lack of client-side caching before any database bottleneck — the redundant fetch pattern would show up as unnecessary request volume well before Postgres itself struggled.**

### 43. How is dark mode implemented?
**CSS custom properties for every color token, toggled by adding/removing a `.dark` class on `<html>`, persisted to `localStorage`.**

### 44. Why did categories default to 10 seeded ones per user instead of being global?
**Keeps categories genuinely user-owned and editable without affecting other users, at the cost of some duplicated rows across users — a deliberate normalization trade-off.**

### 45. How does the demo mode work?
**`prisma/seed.ts` creates a demo user with realistic seeded accounts, transactions, budgets, goals, recurring payments, and notifications — for evaluation without manual data entry.**

### 46. What happens if a category is deleted that has budget items referencing it?
**The schema cascades the delete (`onDelete: Cascade` on `Category → BudgetItem`) — deleting a category silently removes its budget limits too. Worth a dedicated test given the financial-data stakes; not currently tested.**

### 47. How would you add multi-currency support?
**Would require storing an explicit currency per transaction (not just per user), plus either a conversion-rate table or an external FX-rate API call at display time — currently entirely unimplemented; a single currency is stored per user.**

### 48. What's the biggest security risk in the app today?
**No rate limiting on the login endpoint — it's brute-forceable as currently implemented. Named directly and explicitly as the top P0 in `SECURITY.md` and `ROADMAP.md`.**

### 49. How would you add a CI pipeline?
**A lightweight GitHub Actions workflow: install, lint, test, build on every push — proposed and implemented as part of this documentation pass (see `.github/workflows/ci.yml`).**

### 50. If I gave you one week to improve this project, what would you do?
**In order: add rate limiting to the auth routes, add API-level tests for the highest-risk endpoints (auth, ownership checks), fix the Decimal-arithmetic precision gap, and add TanStack Query to eliminate the redundant client-side fetching.** *These are the four highest-leverage fixes, prioritized by risk and effort — see `ROADMAP.md` P0/P1.*

### 51. What's a technical decision you'd defend even if criticized?
**Not using an AI API for the Insights feature.** *It would have been an easy way to look more "impressive," but a hallucinated claim about someone's finances is a real trust failure for this specific kind of product — the rule-based approach is the right call, not a cost-cutting compromise dressed up as a virtue.*

### 52. What's a technical decision you'd reconsider?
**No client-side data cache from the start.** *It was the right call to keep initial complexity low, but I'd introduce TanStack Query earlier next time rather than treating it as a post-hoc optimization.*
