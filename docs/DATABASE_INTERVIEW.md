# FinMate — Database Interview Questions

40+ questions on the actual schema, relationships, and query patterns in `prisma/schema.prisma`
and `services/*.ts`.

## Table of Contents
- [Schema & Relationships](#schema--relationships)
- [Indexes & Query Optimization](#indexes--query-optimization)
- [Transactions & ACID](#transactions--acid)
- [Concurrency & Isolation](#concurrency--isolation)
- [Normalization](#normalization)
- [Scaling](#scaling)

## Schema & Relationships

**1. How many models are in the schema, and what's the general shape?**
14 models, 7 enums. Everything hangs off `User` — 10 of the 14 models have a direct
`userId` foreign key, reflecting that this is a genuinely single-tenant-per-user data
model (no shared/cross-user entities exist).

**2. Describe the relationship between `Transaction` and `Account`.**
Many-to-one — every `Transaction` belongs to exactly one `Account` (`accountId` foreign
key, `onDelete: Cascade`), and one `Account` has many `Transaction`s.

**3. Why does `Transaction` have both a `date` and a `createdAt`?**
`date` is the user-specified transaction date (when the purchase/income actually
happened); `createdAt` is when the database row was inserted (could differ if a user backdates
an entry). Keeping both is deliberate — analytics queries filter/group by `date`, while
`createdAt` exists purely for audit/ordering purposes.

**4. How are Category and Transaction related, and why is `categoryId` nullable?**
One-to-many, `onDelete: SetNull` — a transaction can exist without a category
("Uncategorized"), and if its category is later deleted, the transaction survives with
`categoryId` set to null rather than being deleted itself. This is intentionally different
from `Budget → BudgetItem`'s cascade behavior — a transaction losing its category is a
minor UX inconvenience; a transaction being silently deleted would be a data-integrity
disaster.

**5. Explain the `Tag`/`TransactionTag` many-to-many relationship.**
`Tag` and `Transaction` have a genuine many-to-many relationship (a transaction can have
multiple tags, a tag can apply to multiple transactions), implemented via the standard
Prisma join-table pattern: `TransactionTag` has a composite primary key
`@@id([transactionId, tagId])` and foreign keys to both sides.

**6. Why is there a separate `Budget` and `BudgetItem` model instead of just `Budget` with a category+limit?**
A `Budget` represents "this user's budget for month X, year Y" (enforced unique via
`@@unique([userId, month, year])`); `BudgetItem` represents one category's limit within
that budget. This lets a single month have multiple category limits without duplicating
the month/year on every row — a `Budget` is the parent, `BudgetItem`s are its line items.

**7. How does `Goal` track progress?**
`Goal.currentAmount` is a running total, incremented by each `GoalContribution` row
(atomically, inside `prisma.$transaction` — see `goal.service.ts`). `GoalContribution` is
kept as a separate table (not just incrementing `currentAmount` directly) specifically to
preserve contribution history — when and how much was added, not just the final total.

**8. Why does `RecurringPayment` store `categoryName` as a plain string instead of a `categoryId` foreign key?**
A genuine schema inconsistency worth naming honestly — every other model
(`Transaction`, `BudgetItem`) references `Category` via a proper foreign key, but
`RecurringPayment` stores the category as a denormalized string. This means a recurring
payment's category isn't guaranteed to match an actual `Category` row, and renaming a
category wouldn't update existing recurring payments. Worth fixing (see `ROADMAP.md`), not
a deliberate design choice — likely an oversight from building this model slightly later
than the others.

**9. What does `UserPreference` store, and why is it a separate model from `User`?**
Theme, currency (duplicated from `User.currency` — another minor inconsistency), and
per-notification-type boolean opt-ins. Kept separate from `User` mainly for
organizational clarity (settings vs. identity) — a 1:1 relationship (`@unique` on
`userId`), so it could have been inlined onto `User` directly without a strong technical
reason not to.

**10. How is `Notification`/`Insight` structured, and why no foreign key to what they're about?**
Both store a free-text `message` and (for `Insight`) a `metric` string key rather than a
foreign key to a specific `Transaction`/`Budget`/`Goal` — because a single insight or
notification is often derived from an aggregate across many rows (e.g., "your Food
spending increased 18%" isn't about one transaction, it's about a whole category's
monthly sum), so there's no single row to reference.

## Indexes & Query Optimization

**11. What indexes exist on `Transaction`, and why those specifically?**
`@@index([userId, date])` and `@@index([userId, categoryId])`, plus a single-column
`@@index([accountId])`. The compound indexes match the two most common query shapes
exactly: "list this user's transactions sorted by date" and "sum this user's transactions
grouped by category."

**12. Why a compound index `[userId, date]` instead of two separate single-column indexes?**
A compound index lets Postgres satisfy a `WHERE userId = ? ORDER BY date` query using one
index scan; two separate single-column indexes would require Postgres to either pick just
one (and still scan/sort the rest) or do a more expensive bitmap-index intersection of
both.

**13. What indexes are missing that might matter at scale?**
No index exists on `Transaction.date` alone (without `userId`) — fine today since every
real query is user-scoped, but would matter for a hypothetical future admin/analytics
feature querying across all users by date range.

**14. What unique constraints exist, and what do they enforce?**
`User.email` (one account per email), `Category[userId, name]` (no duplicate category
names per user, but different users can each have their own "Food"), `Tag[userId, name]`
(same pattern), `Budget[userId, month, year]` (one budget per user per month),
`BudgetItem[budgetId, categoryId]` (one limit per category per budget).

**15. How would you find slow queries in this application?**
Postgres's `EXPLAIN ANALYZE` against the actual query patterns, or `pg_stat_statements` in
a running instance — neither has been run against this codebase yet; any specific "this
query takes Xms" claim would be fabricated without that data.

**16. Where's the clearest N+1-shaped inefficiency in this codebase?**
`services/budget.service.ts`'s `getBudgetForMonth` — one `aggregate` query per
`BudgetItem` inside a `Promise.all`, rather than a single `groupBy` across all categories
at once.

**17. How would you fix it?**
Replace the per-item loop with `prisma.transaction.groupBy({ by: ["categoryId"], where:
{userId, type: "EXPENSE", date: {...}}, _sum: {amount: true} })` — one query instead of N.

## Transactions & ACID

**18. Where does this codebase use database transactions, and why?**
`transaction.service.ts` (create/update/delete a `Transaction` + adjust `Account.balance`
atomically) and `goal.service.ts` (create a `GoalContribution` + increment
`Goal.currentAmount` atomically). Both involve writes to two tables that must never go out
of sync.

**19. What does "atomicity" mean in this specific context?**
If the account-balance update inside `createTransaction` failed for any reason after the
transaction row insert succeeded, `prisma.$transaction` rolls back *both* — the user never
ends up with a transaction recorded but a balance that doesn't reflect it, or vice versa.

**20. What isolation level is used, and what does that mean practically?**
Postgres's default `READ COMMITTED` — each query within the transaction sees a snapshot of
data as of when *that query* started, not as of when the transaction began. This is
sufficient to prevent the two writes in `createTransaction` from partially applying, but
does *not* prevent a classic lost-update race between two *separate*, concurrent
`prisma.$transaction` calls both reading and writing the same row (see question 25).

**21. What does the "D" in ACID (Durability) mean here, and is it guaranteed?**
Once Postgres commits a transaction, the write survives a crash — this is guaranteed by
Postgres itself (write-ahead logging), not something the application needs to implement.

## Concurrency & Isolation

**22. What happens if two requests try to update the same transaction simultaneously?**
Both `prisma.$transaction` calls would run against the same `Transaction` and `Account`
rows; under `READ COMMITTED`, the second transaction to commit would overwrite the first's
changes ("last write wins") without either failing — no optimistic-locking version check
exists to detect and reject the conflict.

**23. How would you detect and prevent that specific race condition?**
Add a `version` integer column to the contended row, increment it on every update, and
include `WHERE version = <expected>` in the update — if zero rows are affected, the
application knows a concurrent write happened first and can retry or surface a conflict to
the user (classic optimistic concurrency control).

**24. Why not just use `SERIALIZABLE` isolation for every transaction instead?**
`SERIALIZABLE` would correctly prevent the race but at a real throughput cost (Postgres
must detect and abort conflicting serializable transactions, requiring retry logic
everywhere) — overkill for a personal finance app's actual concurrency profile (one user,
rarely issuing two simultaneous writes to the exact same row). Optimistic concurrency
control on the specific contended fields is the more proportionate fix.

**25. Concretely, what's the actual race condition risk in `addContribution` today?**
```ts
const goal = await prisma.goal.findFirstOrThrow(...);          // read currentAmount
// ... two concurrent requests could both read the same value here ...
await tx.goal.update({ data: { currentAmount: Number(goal.currentAmount) + input.amount } }); // write
```
Two near-simultaneous contributions could both read the same starting `currentAmount` and
each write `starting + their own amount` — the second write overwrites the first's
increment rather than compounding both.

**26. What's the simplest fix for that specific case, without adding a version column?**
Use Prisma's atomic increment syntax instead of read-then-write:
`tx.goal.update({ where: { id }, data: { currentAmount: { increment: input.amount } } })`
— this compiles to a single `UPDATE ... SET currentAmount = currentAmount + $1` SQL
statement, which Postgres executes atomically without an application-level race window at
all. **This is a real, concrete improvement I'd make — tracked in `ROADMAP.md`.**

## Normalization

**27. Is this schema normalized? To what degree?**
3NF throughout — no repeating groups, no transitive dependencies on non-key attributes,
with two deliberate, documented exceptions.

**28. What are the deliberate denormalizations, and why?**
`Account.balance` is a running total rather than being derived by summing all
transactions on every read — a performance-motivated denormalization (showing a balance
shouldn't require scanning potentially thousands of transaction rows). `BudgetItem.status`
is similarly a cached, recomputed value, not the actual source of truth (live transaction
sums are).

**29. What's the risk of denormalizing `Account.balance`, and how is it mitigated?**
The risk is drift — the stored balance could diverge from what transaction history
actually implies, if any code path updated one without the other. Mitigated by keeping
*all* balance mutations inside the same `prisma.$transaction` as the transaction write
that causes them (`transaction.service.ts`) — there's no code path that writes a
transaction without also adjusting the balance in the same atomic operation.

**30. What's the accidental (non-deliberate) inconsistency in the schema?**
`RecurringPayment.categoryName` as a denormalized string instead of a proper
`Category` foreign key (see question 8) — and `currency` being stored on both `User` and
`UserPreference`, with no code enforcing they stay in sync.

## Scaling

**31. Would this schema need to change to support 100,000 users?**
Not significantly — the indexes already match the real query patterns. What would need to
change is *infrastructure* (connection pooling, read replicas), not the schema shape
itself, at that scale.

**32. At what point would the `Transaction` table become a real problem?**
Not from total row count across all users (Postgres indexes handle millions of rows for a
correctly-indexed, user-scoped query pattern like this one just fine) — the realistic
concern would be a single user accumulating tens of thousands of transactions over many
years, which is an unusual but not impossible pattern for a personal finance tool used
for a decade.

**33. How would you partition the `Transaction` table if it became necessary?**
Range-partition by `date` (e.g., yearly partitions) — most real queries filter by a
bounded date range already, so Postgres could skip entire partitions rather than scanning
the full table, while still supporting the existing `[userId, date]` index within each
partition.

**34. Would you ever move to a NoSQL database for this application?**
No — the core value proposition (financial data with real relational integrity: a
transaction must belong to exactly one account, a budget composed of category limits, atomic
multi-row updates) is exactly what a document store gives up in exchange for schema
flexibility this application doesn't need. See `ENGINEERING_DECISIONS.md` #2.

**35. How would read replicas help this specific application?**
The analytics queries (`getCashFlow`, `getSpendingByCategory`, `getMonthSummary`) are
read-heavy and don't need to reflect writes from the last few milliseconds — routing them
to a read replica would offload that load from the primary, which handles the write-path
(transaction creation) that does need to be immediately consistent.

**36. What would you monitor to know when scaling changes are actually needed, rather than guessing?**
Postgres connection-pool saturation, `pg_stat_statements` for actual slow-query
identification, and API response-time percentiles (p50/p95/p99) per endpoint — none of
which are currently instrumented in this codebase; this would be the honest first step
before making any scaling change, not jumping straight to read replicas speculatively.

**37. How does `Decimal(14,2)` behave differently from a `FLOAT`/`DOUBLE` column at scale?**
Identically in terms of storage/index performance characteristics for this data volume —
the difference is purely about representational exactness (base-10 decimal vs. IEEE-754
binary floating point), not query performance.

**38. What's `cuid()` used for as the primary key strategy, and why not auto-incrementing integers?**
Every model uses `@id @default(cuid())` — a collision-resistant, non-sequential string ID
generated application-side. Chosen over integer auto-increment because it doesn't reveal
row-count/creation-order information in URLs (a minor security-through-obscurity benefit)
and doesn't require a round trip to the database to know a new row's ID before referencing
it in related writes.

**39. What would change about the schema if FinMate needed to support shared/family accounts (multiple users on one set of data)?**
Would require introducing a join table between `User` and `Account` (many-to-many, with a
role per membership) rather than `Account.userId` being a direct single foreign key —
currently the schema assumes strict single-user ownership throughout, which is the correct
scope for what was actually built, but would be a real schema migration, not a small
addition, if shared accounts were added later.

**40. If you had to justify one schema decision to a senior engineer reviewing this project, which would you pick and why?**
The choice to keep `Account.balance` as a maintained running total rather than always
computing it live from transaction history — I'd defend it as the correct performance
trade-off for a read-heavy field (balance is displayed on nearly every screen) with a
well-contained, atomically-guaranteed write path, while being upfront that it does
introduce a drift risk that a purely-derived value would not have.
