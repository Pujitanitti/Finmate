# FinMate — API Documentation

26 Route Handlers, all under `app/api/`. Every route follows the same pattern: verify
session → validate with Zod → delegate to a service function → return JSON. Full source is
authoritative; this document mirrors it exactly.

## Table of Contents
- [Conventions](#conventions)
- [Auth](#auth)
- [Transactions](#transactions)
- [Accounts](#accounts)
- [Budgets](#budgets)
- [Goals](#goals)
- [Recurring Payments](#recurring-payments)
- [Notifications](#notifications)
- [Insights](#insights)
- [Analytics](#analytics)
- [Health Score](#health-score)
- [Settings](#settings)
- [Categories](#categories)
- [Onboarding](#onboarding)
- [REST design decisions](#rest-design-decisions)

## Conventions

- **Auth:** every route except `POST /api/auth/register` and `POST /api/auth/login` requires a valid `finmate_session` cookie. Unauthenticated requests receive `401 { "error": "Unauthorized" }`.
- **Validation errors:** `400 { "error": "<first Zod issue message>" }`.
- **Success shape:** varies by route (documented per-endpoint below) — there is no single wrapper envelope across the whole API. This inconsistency is a known gap, not a design choice — see `PROJECT_AUDIT.md`.
- **Ownership:** every resource lookup is scoped by the authenticated `userId`; there is no admin/cross-user endpoint anywhere in this API.

---

## Auth

### `POST /api/auth/register`
No auth required.
**Body:** `{ name: string, email: string, password: string }` — password requires 8+ chars, 1 uppercase, 1 number (`lib/validation/auth.ts`).
**Success `200`:** `{ user: { id, name, email } }` + sets `finmate_session` cookie.
**Errors:** `400` invalid input · `409` email already registered.

### `POST /api/auth/login`
No auth required.
**Body:** `{ email: string, password: string }`.
**Success `200`:** `{ user: { id, name, email } }` + sets cookie.
**Errors:** `400` invalid input · `401` invalid credentials.
**Gap:** no rate limiting — see `SECURITY.md`.

### `POST /api/auth/logout`
Auth required.
**Success `200`:** `{ success: true }`, clears the cookie. **Note:** client-side cookie deletion only — the JWT is not server-side revoked (see `SECURITY.md`).

---

## Transactions

### `GET /api/transactions`
**Query params:** `search`, `categoryId`, `accountId`, `type` (`INCOME`/`EXPENSE`/`TRANSFER`), `page` (default 1), `pageSize` (default 20).
**Success `200`:** `{ items: Transaction[], total, page, pageSize, totalPages }` — the only endpoint in the entire API that paginates.

### `POST /api/transactions`
**Body:** `{ merchant, amount, type, accountId, categoryId?, date, notes?, tags? }`.
**Success `201`:** `{ transaction }`. Also atomically adjusts the owning account's balance (`prisma.$transaction`).

### `PATCH /api/transactions/[id]`
Same body shape as create. Reverses the old balance effect and applies the new one — correctly handles moving a transaction to a different account.
**Success `200`:** `{ transaction }`.

### `DELETE /api/transactions/[id]`
Reverses the transaction's balance effect before deleting.
**Success `200`:** `{ success: true }`.

---

## Accounts

### `GET /api/accounts`
**Success `200`:** `{ accounts: Account[] }` — no pagination (acceptable at realistic per-user account counts).

### `POST /api/accounts`
**Body:** `{ name, type, balance }` — `type` is one of `BANK`/`SAVINGS`/`CASH`/`CREDIT_CARD`/`INVESTMENT`.
**Success `201`:** `{ account }`.

### `PATCH /api/accounts/[id]` / `DELETE /api/accounts/[id]`
Standard update/delete, ownership-checked. Deleting an account cascades to its transactions (`onDelete: Cascade` in schema).

---

## Budgets

### `GET /api/budgets?month=&year=`
Defaults to the current month/year if not provided.
**Success `200`:** `{ budget: { ...items: [{ ...spent, remaining, status }] } | null }` — `spent`/`status` are computed live from real transaction sums, not read from a cache.

### `POST /api/budgets`
**Body:** `{ month, year, items: [{ categoryId, limit }] }` — upserts (creates the month's budget if it doesn't exist, updates category limits if it does).
**Success `201`:** `{ budget }`.

**Gap:** no `DELETE` endpoint exists for removing a single budget category limit — only upsert.

---

## Goals

### `GET /api/goals`
**Success `200`:** `{ goals: Goal[] }` — each includes computed `progress` (%) and `onTrack` (boolean | null, based on recent contribution rate).

### `POST /api/goals`
**Body:** `{ name, targetAmount, targetDate? }`.
**Success `201`:** `{ goal }`.

### `PATCH /api/goals/[id]` / `DELETE /api/goals/[id]`
Standard update/delete, ownership-checked.

### `POST /api/goals/[id]/contributions`
**Body:** `{ amount, note? }`.
**Success `201`:** `{ contribution }`. Atomically creates the contribution and increments `Goal.currentAmount`.

---

## Recurring Payments

### `GET /api/recurring`
**Success `200`:** `{ payments: RecurringPayment[] }`, sorted by `nextDueDate`.

### `POST /api/recurring`
**Body:** `{ name, amount, frequency, categoryName, nextDueDate }`.
**Success `201`:** `{ payment }`.

### `DELETE /api/recurring/[id]`
**Gap:** no `PATCH` — a recurring payment can be deleted but not edited in place today.

---

## Notifications

### `GET /api/notifications`
Also **generates** new notifications as a side effect (budget warnings, upcoming recurring payments) before returning the list — this is a read endpoint with a write side effect, which is a deliberate but worth-noting REST deviation (see [REST design decisions](#rest-design-decisions)).
**Success `200`:** `{ notifications: Notification[] }`.

### `PATCH /api/notifications/[id]`
Marks one notification as read.

### `POST /api/notifications/read-all`
Marks all of the current user's unread notifications as read.

---

## Insights

### `GET /api/insights`
Same read-with-generation-side-effect pattern as notifications — runs the FinMate Insights Engine rules against current data, persists any new insights (deduplicated by `metric` key per day), and returns the most recent 20.
**Success `200`:** `{ insights: Insight[] }`.

---

## Analytics

### `GET /api/analytics/cash-flow?range=`
`range` is one of `7d`/`30d`/`3m`/`6m`/`1y`.
**Success `200`:** `{ data: [{ date, income, expenses, net }] }`.

### `GET /api/analytics/spending`
Current month's spending grouped by category, with month-over-month `changePercent` per category.
**Success `200`:** `{ data: [{ categoryId, categoryName, amount, percent, changePercent }] }`.

### `GET /api/analytics/summary`
**Success `200`:** `{ summary: { totalBalance, monthlyIncome, monthlyExpenses, monthlySavings, ...changePercent fields, savingsRate, previousSavingsRate } }`.

---

## Health Score

### `GET /api/health-score`
Aggregates data across analytics, budgets, goals, and recurring payments, then runs `computeFinancialHealthScore` (a pure function, fully unit-tested — see `TESTING.md`).
**Success `200`:** `{ score: number, breakdown: [{ label, weight, rawValue, scoreContribution, maxContribution }] }`.

---

## Settings

### `PATCH /api/settings/profile`
**Body:** `{ name }`.

### `PATCH /api/settings/password`
**Body:** `{ currentPassword, newPassword }`. Verifies the current password with `bcrypt.compare` before allowing the change — this is real, not cosmetic.
**Errors:** `401` if `currentPassword` is wrong.

### `PATCH /api/settings/preferences`
**Body:** any subset of `{ theme, currency, notifyBudgetWarning, notifyGoalMilestone, notifyRecurring, notifyMonthlySummary }`.

---

## Categories

### `GET /api/categories`
**Success `200`:** `{ categories: Category[] }`.

### `POST /api/categories`
**Body:** `{ name, color? }`. Lets a user add a custom category beyond the 10 seeded defaults.

---

## Onboarding

### `POST /api/onboarding`
**Body:** `{ monthlyIncome, goals: string[], currency }`. Marks `User.onboarded = true` and creates placeholder `Goal` rows from the selected onboarding goal names.

---

## REST design decisions

- **Idempotency:** `PATCH` and `DELETE` operations are naturally idempotent (repeating a `DELETE` on an already-deleted resource throws, which is standard REST behavior, not idempotent in the strict HTTP sense — no idempotency-key mechanism exists here). `POST` operations are **not** idempotent — submitting the same "add transaction" request twice creates two transactions. There is no client-side duplicate-submission guard beyond disabling the submit button during the request.
- **Pagination:** implemented only on `GET /api/transactions`. Every other list endpoint returns its full result set. This is a genuine gap at scale, not a design choice — see `ROADMAP.md`.
- **Filtering/sorting:** transactions support `search`/`categoryId`/`accountId`/`type` filters and `sortBy`/`sortDir` params in the service layer (`listTransactions`), though the route currently only exposes `search`/`categoryId`/`accountId`/`type`/`page`/`pageSize` — `sortBy`/`sortDir` exist in `TransactionFilters` but are not yet wired through the query string.
- **Rate limiting:** **not implemented anywhere.** See `SECURITY.md`.
- **API versioning:** **not implemented** — there is a single unversioned API surface (`/api/*`). Acceptable for a single first-party client, would need `/api/v1/` prefixing before any external/public API consumer.
- **Caching:** **not implemented** — no `Cache-Control` headers, no ETags, no server-side response caching anywhere in the API layer.
