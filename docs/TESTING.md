# FinMate — Testing Documentation

## Table of Contents
- [Current state](#current-state)
- [What is tested today](#what-is-tested-today)
- [What is NOT tested](#what-is-not-tested)
- [Recommended testing strategy](#recommended-testing-strategy)
- [Prioritized test plan](#prioritized-test-plan)
- [Financial/application edge cases to cover](#financialapplication-edge-cases-to-cover)

## Current state

**Updated after a hardening pass** — see `docs/PROJECT_AUDIT.md` for the full list of
what changed. The single biggest testing gap from the original audit (zero verification
of cross-user data isolation, the most important security property in this codebase) is
now closed.

**Unit tests:** 6 Vitest files (`tests/*.test.ts`), testing pure business-logic functions
with no database or network dependency — fast, deterministic, and genuinely useful. Added
in this pass: `rateLimit.test.ts` (token-bucket refill/isolation behavior) and
`useApiQuery.test.ts` (caching, deduplication, and invalidation behavior).

**Integration tests:** 3 new Vitest files (`tests/integration/*.integration.test.ts`),
running against a real PostgreSQL database (see `tests/integration/README.md`):
- `auth.integration.test.ts` — registration, duplicate-email rejection, login, wrong-password rejection.
- `ownership.integration.test.ts` — **the highest-value test in this codebase**: proves that one user genuinely cannot read, update, or delete another user's transactions or goals, and includes a dedicated concurrency test firing 10 simultaneous goal contributions to prove the atomic-increment fix (see `docs/DATABASE_INTERVIEW.md` Q25/Q26) actually holds.
- `sessionRevocation.integration.test.ts` — proves a token issued before `revokeAllSessions()` is rejected afterward, and that a freshly re-issued token is valid again.

Run locally with `npm run test:integration` (requires a running, migrated Postgres — see
`tests/integration/README.md`). Run automatically in CI against a real Postgres service
container on every push (`.github/workflows/ci.yml`).

**E2E tests:** 1 Playwright spec (`tests/e2e/full-flow.spec.ts`) covering the core user
journey. Unchanged in this pass.

**Component tests:** still none — not addressed in this pass, remains a named gap.
**Direct HTTP-layer route tests:** still none — the integration tests above test the
service layer directly (see the rationale in `tests/integration/README.md`), which
verifies the same security-critical logic every route handler thinly wraps, without the
added infrastructure of spinning up a full HTTP server in the test itself.
**Test coverage reporting:** not configured (no `vitest --coverage` in any script).

This is an honest, real gap — not a hidden one. See `PROJECT_AUDIT.md` for how this affects
the overall score.

## What is tested today

### `tests/financialHealth.test.ts`
Tests `computeFinancialHealthScore` — verifies a perfect input profile scores exactly 100,
a worst-case profile scores exactly 0, that the savings-rate factor correctly caps at its
maximum weight above the 30% threshold, and that the sum of all breakdown contributions
always equals the total score (a genuinely important invariant for a feature whose whole
value proposition is "the score is transparently explainable").

### `tests/budget.test.ts`
Tests `computeBudgetStatus` — the three threshold boundaries (`<80%` Healthy, `80–100%`
Warning, `≥100%` Exceeded) and the edge case of a zero budget limit.

### `tests/goal.test.ts`
Tests `computeGoalProgress` (percentage funded, capped at 100, zero-target edge case) and
`isGoalOnTrack` (null when no target date/contribution rate exists, true/false projection
based on months remaining vs. required monthly contribution).

### `tests/categorization.test.ts`
Tests `suggestCategory` against 7 known merchant-name patterns, the "Other" fallback for
unrecognized merchants, and explicitly documents that the suggestion is a default the user
can always override (not testable in code, but documented in the test file as a design
note).

### `tests/e2e/full-flow.spec.ts`
Register → onboarding (4 steps) → dashboard loads → create account → add transaction →
create budget → create goal → return to dashboard and verify analytics render. This is the
single highest-value test in the repository because it exercises the real database, real
API routes, and real UI together — but it is also the only test doing so, which is a gap.

## What is NOT tested

- **API route handlers** — no test calls `POST /api/transactions` (or any other route) directly and asserts on the HTTP response. The business logic those routes call *is* tested (via the service-layer unit tests), but the routing/validation/auth-guard glue code around it is not.
- **Service functions that touch the database** — `createTransaction`, `upsertBudget`, `listGoalsWithProgress`, etc. are not unit-tested because they require a real Postgres connection; only their *pure* sub-logic (`computeBudgetStatus`, `computeGoalProgress`) is tested in isolation.
- **React components** — no `TransactionsTable`, `TransactionFormModal`, `BudgetBoard`, etc. has a component test. Form validation, loading states, and error states are all manually-verified only.
- **Authentication flows** — no unit test exists for `hashPassword`/`verifyPassword`/`createSession`/`getSession` in isolation (though they are exercised indirectly by the E2E spec).
- **Concurrency/race conditions** — no test simulates two simultaneous requests modifying the same account or goal.
- **Error paths** — no test asserts that invalid input actually produces a 400, that an unowned resource actually produces the expected error, etc.

## Recommended testing strategy

A pragmatic three-layer pyramid, prioritized by what actually catches real bugs in this
specific codebase:

1. **Unit tests (fast, no DB)** — already the strongest layer; extend to cover
   `services/analytics.service.ts`'s pure calculation helpers (percentage-change math) and
   `services/notification.service.ts`'s dedup logic.
2. **API/integration tests (real DB, no browser)** — the biggest missing layer. Use
   Vitest + a test Postgres database (or Prisma's test-transaction pattern) to call route
   handlers directly and assert on status codes and response shapes, especially for auth
   and ownership-check paths (`"user A cannot delete user B's transaction"` is exactly the
   kind of test that would catch a real security regression).
3. **E2E tests (real browser)** — already exists for the happy path; extend with a small
   number of high-value negative-path flows (invalid login, attempting to access another
   user's data by manipulating a URL) rather than exhaustively re-testing every CRUD
   operation at this layer (expensive, slow, and redundant with layer 2).

## Prioritized test plan

### P0 — highest value

- ✅ **DONE:** a user cannot modify a transaction/goal belonging to another user — `tests/integration/ownership.integration.test.ts`.
- ✅ **DONE:** `POST /api/auth/register` (via `registerUser`) rejects a duplicate email — `tests/integration/auth.integration.test.ts`.
- ✅ **DONE:** login rejects a wrong password without leaking whether the email exists (asserts the identical error message for both cases) — `tests/integration/auth.integration.test.ts`.
- Remaining: a direct HTTP-layer test asserting `POST /api/transactions` with an invalid body returns exactly `400` with the expected message — the underlying Zod validation is exercised indirectly by the unit tests on validation schemas, but no test calls the route handler itself.

### P1
- Component test: `TransactionFormModal` — submitting with a missing required field shows the expected validation state; a successful submit calls `onSaved`.
- Service test (DB-backed): `createTransaction` correctly updates the account balance for each of `INCOME`/`EXPENSE`/`TRANSFER`.
- Service test (DB-backed): `updateTransaction` correctly reverses the old balance effect when the transaction's account is changed.

### P2
- E2E: attempting to visit `/dashboard` while logged out redirects to `/login`.
- E2E: dark mode toggle persists across a page reload.
- Coverage reporting wired into CI with a baseline threshold (not 100% — a realistic threshold like 60–70% on the service layer).

## Financial/application edge cases to cover

These are the edge cases most worth being able to name in an interview, whether or not a
test currently exists for each:

- Adding a transaction with `amount = 0` — currently rejected by Zod (`z.number().positive()`), correctly.
- Deleting an account that has transactions — currently cascades (`onDelete: Cascade`), which deletes transaction history along with the account. **Worth flagging:** this may not be the desired product behavior (a user might expect historical transactions to remain visible, just marked "account deleted") — a legitimate design discussion, not a bug.
- Two simultaneous requests both adding a contribution to the same goal — see the concurrency gap noted in `DATABASE.md`.
- A budget for a category that is later deleted — `BudgetItem.categoryId` has no explicit cascade behavior tested; the schema's `onDelete: Cascade` on `Category → BudgetItem` means deleting a category silently deletes its budget items too, which is worth a dedicated test given the financial-data stakes.
- Currency formatting for very large numbers (`formatCurrency`'s compact-notation Cr/L/K logic in `lib/utils/format.ts`) — not currently unit-tested despite being pure, easily-testable logic.
- Month boundary handling in `getMonthSummary`/`getSpendingByCategory` (`analytics.service.ts`) — not tested for timezone edge cases around month start/end.
