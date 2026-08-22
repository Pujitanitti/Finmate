# FinMate — Engineering Roadmap

Prioritized by actual security/correctness risk and FAANG-interview defensibility, not by
what looks most impressive to add.

**Status update:** all four P0 items and most P1 items below are now implemented — see
`docs/PROJECT_AUDIT.md`'s "What moved, concretely" section for the exact files changed.
Each item below is marked ✅ **DONE** with what was actually built, or left unmarked if
still outstanding.

## P0 — Critical

### 1. Rate limiting on authentication endpoints — ✅ DONE
**Problem:** `/api/auth/login` and `/api/auth/register` have no rate limiting — the login
endpoint is brute-forceable today.
**What was built:** an in-memory token-bucket limiter (`lib/security/rate-limit.ts`),
applied directly in both route handlers — 5 attempts/5min for login, 3 attempts/15min for
register. Unit-tested (`tests/rateLimit.test.ts`). Explicitly documented as single-instance
scope; a Redis-backed swap is the documented next step if the app is ever horizontally
scaled — see `docs/SECURITY.md`.
**Why it matters:** the single most concrete, previously-unaddressed security gap in the codebase.
**Complexity:** Low (in-memory) to Medium (Redis-backed, not yet needed).
**Benefit realized:** closes the most realistic attack vector against user accounts.

### 2. Fix Decimal arithmetic precision gap — ✅ DONE (goal contributions); analytics-display conversions reassessed as safe
**Problem:** several service functions convert `Prisma.Decimal` to JS `number` before doing
addition/subtraction, reintroducing floating-point risk in the calculation step despite
exact storage.
**What was actually found on closer inspection:** the concrete, exploitable instance of
this was `goal.service.ts`'s `addContribution`, which read `currentAmount`, added in JS,
and wrote back — a genuine read-then-write pattern. This is now fixed using Prisma's
atomic `{ increment }` syntax, which also happens to close the related race-condition gap
(see item 9 below) in the same fix. `transaction.service.ts`'s balance adjustments were
re-examined and found to already use atomic `{ increment }` (the sign-flipping in
`signedAmount()` operates on a single input value, not a sum of two decimals, so it does
not carry the same precision risk originally attributed to it — the original audit
slightly overstated this one). The remaining `Number(...)` conversions across
`analytics.service.ts`, `budget.service.ts`, etc. are all for **read-only display
aggregation** (e.g., summing amounts to show a monthly total), never written back to a
Decimal column, which is standard and safe practice.
**Complexity:** Low.
**Benefit realized:** the one real read-then-write precision/race risk is closed.

### 3. API-level tests for auth and ownership paths — ✅ DONE
**Problem:** zero tests exist that call an API route directly and assert on the HTTP
response — the ownership-check security property ("user A cannot modify user B's data") is
enforced by code but not verified by any test.
**What was built:** three integration test files running against a real database (not
mocked), covering exactly this: `auth.integration.test.ts` (duplicate email → rejected,
wrong password → rejected with an identical message to the nonexistent-email case),
`ownership.integration.test.ts` (the highest-value one — proves cross-user isolation for
transactions and goals, plus a concurrency test), and `sessionRevocation.integration.test.ts`.
Wired into CI against a real Postgres service container.
**Complexity:** Medium — required test-database setup, now in place (`vitest.integration.config.ts`, `tests/integration/README.md`).
**Benefit realized:** the ownership-isolation property — the single most important security
guarantee in this codebase — converted from an implicit, code-only property into a
verified, CI-enforced one.

### 4. Security headers — ✅ DONE
**Problem:** `next.config.js` set no `Content-Security-Policy`, `X-Frame-Options`,
`X-Content-Type-Options`, or `Strict-Transport-Security` headers.
**What was built:** a `headers()` function in `next.config.js` applying CSP,
X-Frame-Options, X-Content-Type-Options, Referrer-Policy, and Permissions-Policy to every
route.
**Complexity:** Low.
**Benefit realized:** closes an easy, commonly-checked-for gap.

## P1 — High value

### 5. Client-side data caching — ✅ DONE (custom hook, not TanStack Query)
**Problem:** 11 independent fetch call-sites with zero deduplication — every navigation
re-fetches everything from zero.
**What was built:** `lib/hooks/use-api-query.ts` — a purpose-built ~100-line caching +
in-flight-deduplication hook, deliberately built instead of adopting TanStack Query (see
the in-file comment explaining why: FinMate's actual need — dedupe, short-TTL cache,
targeted invalidation — is narrow enough that a small custom hook covers it fully without
a new dependency's larger surface area). Migrated into the 5 highest-traffic components:
`HealthScoreCard`, `InsightsPreview`, `NotificationBell`, `SpendingBreakdown`,
`CashFlowChart`. Invalidation is correctly wired into every mutation that affects cached
data — transaction create/delete, budget creation, goal contributions, account
create/delete, recurring payment create/delete — and the entire cache is cleared on
logout to prevent cross-user data leakage on a shared browser. Unit-tested
(`tests/useApiQuery.test.ts`) for caching, deduplication, and invalidation behavior.
**Complexity:** Medium.
**Benefit realized:** eliminates redundant requests on the highest-traffic components;
TanStack Query remains the documented upgrade path if caching needs grow beyond this
hook's scope (background refetching, offline support, complex dependent queries).

### 6. Session revocation — ✅ DONE
**Problem:** logging out only deletes the client cookie; the JWT remains valid server-side
until its 7-day expiry regardless of logout or password change.
**What was built:** `User.sessionVersion`, embedded in the JWT, bump
it on logout/password-change, check it against the current DB value on every request.
**Why it matters:** closes a real, explainable session-security gap.
**Complexity:** Medium.
**Benefit realized:** a stolen or leaked token is now invalidated immediately instead of
remaining valid for up to a week. Verified by `tests/integration/sessionRevocation.integration.test.ts`.

### 7. Pagination on remaining list endpoints — ✅ PARTIALLY DONE
**Problem:** only `GET /api/transactions` paginated; budgets, goals, accounts, recurring
payments, notifications, and insights all returned their full result set.
**What was built:** real, backward-compatible pagination added to `GET /api/notifications`
and `GET /api/insights` specifically — these were the two models explicitly flagged for
genuinely unbounded per-user growth (see `docs/DATABASE.md`). Budgets, goals, accounts,
and recurring payments were deliberately left unpaginated on reassessment: these are
naturally small, bounded-per-user collections (a handful of accounts, one budget per
month, a handful of recurring bills) where pagination would add API complexity without a
real corresponding benefit — a documented engineering judgment call, not an oversight.
**Complexity:** Low.
**Benefit realized:** the two endpoints with genuine unbounded-growth risk now scale
correctly; the others were judged not to need it.

### 8. Fix `RecurringPayment.categoryName` denormalization — ✅ DONE
**Problem:** every other model references `Category` via a proper foreign key;
`RecurringPayment` stored a plain string instead, which could drift from actual category
names.
**What was built:** `RecurringPayment.categoryName` (String) replaced with
`RecurringPayment.categoryId` (proper FK to `Category`, `onDelete: SetNull`) in the schema.
Updated consistently across `lib/validation/recurring.ts`, `services/recurring.service.ts`,
`components/recurring/recurring-board.tsx` (now a real category dropdown instead of free
text), `app/(app)/recurring/page.tsx`, and `prisma/seed.ts`.
**Complexity:** Low-Medium — required a schema migration.
**Benefit realized:** consistent, referentially-correct schema; recurring payments now use
the same category system (including the shared `CategoryIcon` component) as every other
part of the app.

### 9. Atomic increment for goal contributions — ✅ DONE
**Problem:** `addContribution` read `currentAmount` then wrote `currentAmount + amount` —
a real, if narrow, race condition under concurrent contributions to the same goal.
**What was built:** replaced with Prisma's atomic `{ increment: amount }` update syntax —
a single SQL `UPDATE ... SET currentAmount = currentAmount + $1` statement instead of an
application-level read-modify-write.
**Complexity:** Low.
**Benefit realized:** eliminates the specific lost-update race condition entirely —
verified by a dedicated concurrency test in
`tests/integration/ownership.integration.test.ts` that fires 10 simultaneous contributions
and asserts none were lost.

### 10. Error monitoring
**Problem:** no centralized error logging or monitoring exists — a production failure
would be invisible without manually checking server logs.
**Proposed solution:** integrate a free-tier error monitoring service (e.g., Sentry) plus
a React error boundary around the app shell.
**Why it matters:** basic production observability that currently doesn't exist at all.
**Complexity:** Low-Medium.
**Expected benefit:** visibility into real failures instead of silent ones.
**Status:** not addressed in this pass — remains the top-priority item for the next round.

## P2 — Nice to have

### 11. Component tests for highest-traffic components
Focus on `TransactionsTable` and `TransactionFormModal` first — React Testing Library,
covering validation states and successful-submit callback behavior.
**Complexity:** Medium. **Expected benefit:** catches regressions in the most-used UI.

### 12. Optimistic UI updates
Replace the current "wait for response, then refetch full list" pattern with optimistic
local updates for create/delete actions.
**Complexity:** Medium. **Expected benefit:** snappier perceived interactivity.

### 13. Idempotency keys on transaction creation
Prevent duplicate transactions from a client retry after a network timeout.
**Complexity:** Low-Medium. **Expected benefit:** closes a real, if narrow, duplication risk.

### 14. Structured logging
Replace ad hoc `console.error` calls with structured, request-ID-correlated logging.
**Complexity:** Low. **Expected benefit:** materially easier production debugging.

### 15. Dependency vulnerability scanning
Add Dependabot or Renovate configuration; run `npm audit` in CI.
**Complexity:** Low. **Expected benefit:** proactive visibility into vulnerable dependencies.

## Future / Scale

These are explicitly **not** recommended at current scale — listed here to show they were
considered and deliberately deferred, not overlooked:

- **Redis caching layer** — justified once read-heavy endpoints (analytics) show
  measurable load, realistically the 10,000+ user mark.
- **Read replicas** — justified once analytics query load meaningfully competes with the
  write path for database resources, realistically the 100,000+ user mark.
- **Background job queue** (SQS or similar) — justified once notification/insight
  generation needs to run on a schedule independent of user requests, rather than as a
  lazy side effect of a GET request.
- **Database partitioning** — justified only if individual users' transaction history
  grows into the tens of thousands of rows (uncommon, but possible over many years of
  real use).
- **Multi-currency support** — a genuine product feature, not a scale concern; would
  require storing currency per-transaction and either a conversion-rate table or an FX-rate
  API integration.
- **Bank-linking (Plaid or similar)** — explicitly out of scope for the project's
  zero-cost constraint; would be the single biggest product-scope change if ever added.

**Explicitly rejected regardless of scale reached:** microservices decomposition, Kafka,
Kubernetes, and GraphQL — none of these are justified by anything about FinMate's actual
domain shape (single-tenant-per-user data, no cross-user real-time interaction), and adding
them would be complexity for appearance, not for a genuine requirement.
