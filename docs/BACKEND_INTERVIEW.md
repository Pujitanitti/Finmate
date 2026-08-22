# FinMate — Backend Interview Questions

40+ questions, answered from the actual implementation in `app/api/`, `services/`, and `lib/`.

## Table of Contents
- [API Architecture & HTTP](#api-architecture--http)
- [Authentication & Authorization](#authentication--authorization)
- [Middleware & Validation](#middleware--validation)
- [Database Interaction & Transactions](#database-interaction--transactions)
- [Error Handling](#error-handling)
- [Concurrency, Caching, Rate Limiting](#concurrency-caching-rate-limiting)
- [Security & Scalability](#security--scalability)

## API Architecture & HTTP

**1. Describe the backend architecture in one sentence.**
Route Handlers (thin HTTP glue) → Service layer (business logic) → Prisma Client → PostgreSQL, with every route following the same verify-session → validate → delegate → respond pattern.

**2. Why is there a separate service layer instead of putting logic in route handlers?**
Testability and reuse — service functions have zero knowledge of HTTP and can be called
directly from Server Components (see `app/(app)/dashboard/page.tsx` calling
`getMonthSummary` directly) as well as from Route Handlers, without duplicating logic.

**3. What HTTP methods are used, and how consistently?**
`GET` for reads, `POST` for creation, `PATCH` for partial updates, `DELETE` for removal —
standard REST verb usage throughout all 25 routes, no `PUT` usage (all updates are partial
by nature here, so `PATCH` was the consistent choice).

**4. Is the API RESTful?**
Mostly — resources map to URL paths (`/api/transactions/[id]`), standard verbs are used
correctly. Two deliberate deviations: `GET /api/notifications` and `GET /api/insights`
both have a write side effect (generating new records) as part of a read request — a
pragmatic choice explained in question 8 below, not an oversight.

**5. How is a new API route added, concretely?**
Create `app/api/<resource>/route.ts` exporting `GET`/`POST` functions; add a Zod schema to
`lib/validation/<resource>.ts`; add the business logic to a new or existing file in
`services/`. The pattern is consistent enough across all 25 existing routes that a new one
is close to boilerplate.

**6. What does a typical route handler look like, step by step?**
```ts
export async function POST(req: NextRequest) {
  const { session, response } = await requireSession();
  if (!session) return response;               // 1. auth
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: ... }, { status: 400 }); // 2. validate
  const result = await someService(session.userId, parsed.data);                  // 3. delegate
  return NextResponse.json({ result }, { status: 201 });                          // 4. respond
}
```

**7. Why does `requireSession()` return both `session` and `response`?**
So the calling route can do `if (!session) return response;` in one line — a small
ergonomic helper (`lib/auth/require-session.ts`) rather than duplicating the 401 JSON
response construction in all 25 route files.

**8. Why do `GET /api/notifications` and `GET /api/insights` have write side effects?**
A pragmatic simplification — there's no background job scheduler in this codebase, so
"check if new notifications/insights should exist" happens lazily, triggered by the user
actually viewing that section, rather than on a cron schedule. Honest trade-off: this
means a notification a user should see might not be generated until they open the
Notifications tab specifically. The correct production fix is a scheduled job (see
`SYSTEM_DESIGN.md`'s notification-system design).

## Authentication & Authorization

**9. Walk through the login flow server-side.**
`POST /api/auth/login` → Zod validates `{email, password}` → `loginUser` service function
→ `prisma.user.findUnique({where: {email}})` → `bcrypt.compare(password, user.passwordHash)`
→ on success, `createSession({userId, email})` signs a JWT and sets it as an HttpOnly
cookie via `next/headers`'s `cookies()`.

**10. What's in the JWT payload?**
Only `userId` and `email` — no role, no permissions, no sensitive data. Kept minimal
deliberately.

**11. How is the JWT verified on each request?**
Two places: `middleware.ts` (edge runtime, using `jose`'s `jwtVerify` directly against
`AUTH_SECRET`) for route protection/redirection, and `lib/auth/session.ts`'s `getSession()`
(Node runtime, used inside Server Components and `requireSession()`) for reading the actual
session payload.

**12. Why verify the JWT in both middleware AND `requireSession()`? Isn't that redundant?**
Not redundant — different purposes. Middleware only needs a boolean (authenticated or not)
to decide whether to redirect; `requireSession()` needs the actual `userId` to scope
database queries. Middleware runs on the edge before any page code executes; `getSession()`
runs where the actual data access happens.

**13. How does the app know a request is authorized to modify a specific resource, not just authenticated?**
Every service mutation function does `prisma.<model>.findFirstOrThrow({ where: { id, userId }
})` before writing — this throws if the resource doesn't exist *or* belongs to a different
user, treating "not found" and "not yours" identically at the data layer (a deliberate
security pattern — not revealing whether a resource exists for another user).

**14. What's the biggest authorization gap you're aware of?**
No role-based access control exists at all — there's no admin capability in this codebase.
Not a gap for the current feature set, but a real "how would you add X" follow-up worth
having an answer ready for (see `INTERVIEW_PREP.md` Q4).

## Middleware & Validation

**15. What does `middleware.ts` actually do?**
Checks whether the request path matches a protected prefix (`/dashboard`, `/transactions`,
etc.) or an auth-page path (`/login`, `/register`); redirects unauthenticated users away
from protected routes and authenticated users away from auth pages.

**16. Why is middleware necessary if routes already check the session themselves?**
Middleware runs before any React rendering happens, at the edge — it prevents wasted work
(rendering a protected page's shell) for a request that's going to be redirected anyway,
and it's the mechanism that actually performs the redirect for page navigations (Route
Handlers return JSON errors, not redirects).

**17. How is request validation structured?**
One Zod schema file per resource in `lib/validation/`, each exporting the schema and an
inferred TypeScript type (e.g., `TransactionInput`) — the same schema is the single source
of truth for both the shape used in route handlers and (where wired up) client-side form
typing.

**18. What happens if a request body is malformed JSON?**
`req.json().catch(() => null)` — a parse failure becomes `null`, which then fails
`schema.safeParse(null)`, returning a clean 400 rather than an unhandled exception.

**19. Is there any validation on query parameters, not just request bodies?**
Partially — e.g., `GET /api/transactions` reads `page`/`pageSize` from `searchParams` and
coerces with `Number(...)`, but doesn't Zod-validate the query string shape as strictly as
POST bodies are validated. A minor inconsistency worth naming if asked directly.

## Database Interaction & Transactions

**20. What ORM is used, and how is the client instantiated?**
Prisma Client, instantiated once as a singleton in `lib/db/prisma.ts`, using a
`globalThis` cache pattern to avoid creating a new client (and new connection pool) on
every hot-reload in development.

**21. Where are database transactions (`prisma.$transaction`) actually used?**
Two places: `transaction.service.ts` (creating/updating/deleting a `Transaction` and
adjusting the owning `Account.balance` atomically) and `goal.service.ts` (creating a
`GoalContribution` and incrementing `Goal.currentAmount` atomically).

**22. Why do those two operations specifically need a transaction?**
Because they involve writing to two different tables that must stay consistent — if the
account-balance update failed after the transaction row was already created (or vice
versa), the user's displayed balance would silently diverge from their actual transaction
history. `prisma.$transaction` guarantees both writes succeed or both roll back.

**23. What isolation level does `prisma.$transaction` use by default?**
Postgres's default, `READ COMMITTED` — not explicitly overridden anywhere in this
codebase. No `SERIALIZABLE` or explicit row locking is used, which is an honest gap under
genuine concurrent-write scenarios (see question 26 in `SYSTEM_DESIGN.md`'s discussion).

**24. How is pagination implemented for transactions?**
Standard offset-based pagination via Prisma's `skip`/`take` (`skip: (page-1)*pageSize,
take: pageSize`), plus a separate `count()` query for `total`, run in parallel via
`Promise.all`.

**25. Why offset-based pagination instead of cursor-based?**
Simplicity, and it's the only endpoint that paginates at all currently — offset pagination
has a well-known performance degradation on very large offsets, which would matter at a
scale (tens of thousands of transactions for a single user) this project isn't
realistically operating at yet. Cursor-based pagination would be the correct upgrade if
that changed.

**26. How does `services/budget.service.ts` compute live budget status?**
For each `BudgetItem`, it runs `prisma.transaction.aggregate({ where: { userId,
categoryId, type: "EXPENSE", date: {gte, lt} }, _sum: { amount: true } })` — a real SUM
query against actual transactions, not a stored/cached total, so it can never drift from
reality.

**27. What's a concrete inefficiency you can point to in the service layer?**
`getBudgetForMonth`'s per-item aggregate runs once per `BudgetItem` inside a `Promise.all`
loop — N queries where a single `groupBy` query would return the same result in one round
trip. Named directly in `PERFORMANCE.md`.

## Error Handling

**28. What's the standard error response shape?**
`{ error: string }` with an appropriate status code — 400 for validation failures, 401 for
missing/invalid session, 409 for conflicts (duplicate email on registration), 500 for
unexpected errors. **Gap:** this shape isn't formally documented as a contract or enforced
by a shared response helper — each route constructs it manually, which is consistent in
practice but not guaranteed by any shared type.

**29. How are unexpected (non-validation) errors handled?**
Wrapped in try/catch in most routes, logged with `console.error`, and returned as a
generic `{error: "Something went wrong."}` with a 500 — deliberately not leaking internal
error details to the client.

**30. What happens if a service function throws (e.g., `findFirstOrThrow` on a resource that doesn't belong to the user)?**
Currently, not every route explicitly catches this — it can surface as an unhandled 500 in
some routes rather than a clean 403/404. A real, named gap tracked in `ROADMAP.md`.

**31. How would you improve error handling?**
A shared error-handling wrapper for route handlers that catches known error types
(Prisma's `NotFoundError`, Zod's `ZodError`) and maps them to the correct status code
consistently, rather than relying on each route's individual try/catch to get it right.

## Concurrency, Caching, Rate Limiting

**32. Is there any caching in the backend?**
None — no `Cache-Control` headers, no in-memory cache, no Redis. Every request hits the
database directly.

**33. Is there any rate limiting?**
None, anywhere. The single biggest named security gap in the project — see `SECURITY.md`.

**34. How would you add rate limiting without adding infrastructure (no Redis)?**
An in-memory token-bucket keyed by IP inside `middleware.ts`, sufficient for a
single-instance deployment; would need a shared store (Redis, or a Postgres table) the
moment the app runs on more than one server instance, since in-memory state wouldn't be
shared across instances.

**35. How would concurrent requests to increment a goal's `currentAmount` be handled today?**
Each request runs its own `prisma.$transaction`, reading the current value and writing
`currentAmount + amount`. Two near-simultaneous requests could both read the same starting
value and one increment could be lost — a real, unaddressed race condition at genuine
concurrency (unlikely for a single user's personal actions, but worth naming honestly).

**36. How would you fix that race condition?**
Use an atomic increment expression at the database level (Prisma's `{ increment: amount }`
update syntax) instead of read-then-write — this pushes the increment into a single SQL
`UPDATE ... SET amount = amount + $1` statement, which Postgres handles atomically without
needing application-level locking.

## Security & Scalability

**37. What's the single most important security property this backend has?**
Every service function scopes every query by the authenticated user's ID, sourced only
from the verified session — never from client-supplied input. This is the property that
prevents cross-user data access even if IDs are guessed.

**38. What's missing that you'd add before a real production launch?**
In priority order: rate limiting on auth endpoints, session revocation, security headers,
and structured error monitoring — all detailed with fixes in `SECURITY.md`.

**39. How would this backend need to change to support 100,000 users?**
Connection pooling (PgBouncer or a managed pooler), a caching layer for read-heavy
endpoints, and moving the notification/insight generation out of request-time side effects
into a scheduled background job — see `PERFORMANCE.md`'s growth-scenario breakdown.

**40. Would you ever introduce a message queue for this backend?**
Not at current or near-term scale — the workloads here (notification generation, insight
computation) are lightweight and synchronous today. A queue becomes justified once those
jobs are moved to scheduled/background execution at real scale (100K+ users), not before —
see `SYSTEM_DESIGN.md`.
