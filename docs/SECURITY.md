# FinMate — Security Documentation

Brutally honest, code-grounded. Every `CURRENT GAP` below is real and unfixed as of this
audit — nothing is hidden.

## Table of Contents
- [Authentication](#authentication)
- [Authorization](#authorization)
- [Session/token handling](#sessiontoken-handling)
- [Password handling](#password-handling)
- [Input validation](#input-validation)
- [SQL injection](#sql-injection)
- [XSS](#xss)
- [CSRF](#csrf)
- [CORS](#cors)
- [Sensitive data exposure](#sensitive-data-exposure)
- [Environment variables & secrets](#environment-variables--secrets)
- [API abuse / rate limiting](#api-abuse--rate-limiting)
- [Logging](#logging)
- [Dependency vulnerabilities](#dependency-vulnerabilities)
- [Secure headers](#secure-headers)
- [User data isolation](#user-data-isolation)
- [Summary table](#summary-table)

## Authentication

**Implemented:** email/password registration and login. Passwords are hashed with
`bcryptjs` at cost factor 12 (`lib/auth/password.ts`) before ever touching the database —
plaintext passwords are never stored or logged.

**CURRENT GAP:** no account lockout or exponential backoff after repeated failed login
attempts. Combined with the rate-limiting gap below, `/api/auth/login` is brute-forceable
today. **Fix:** add a per-IP and/or per-email attempt counter (even a simple in-memory or
Postgres-backed one) that locks out after N failures for a cooldown period.

## Authorization

**Implemented:** every service function that reads or writes user data is explicitly
scoped by `userId` from the verified session — see `services/transaction.service.ts`,
`services/goal.service.ts`, `services/account.service.ts`, etc. Mutations additionally
re-verify ownership with `findFirstOrThrow({ where: { id, userId } })` before writing, so
even a correctly-guessed resource ID belonging to another user cannot be read or modified.
This is real and verifiable by reading the service layer directly — it is the strongest
security property in this codebase.

**CURRENT GAP:** there is no role-based access control (no admin role exists at all) — not
a gap for the current feature set, but worth stating explicitly since "how would you add an
admin role" is a realistic follow-up question (see `WHY_QUESTIONS.md`).

## Session/token handling

**Implemented:** sessions are signed JWTs (`jose`, HS256) stored in an `HttpOnly`,
`SameSite=Lax`, `Secure` (in production) cookie with a 7-day expiry
(`lib/auth/session.ts`). `HttpOnly` means client-side JavaScript cannot read the token —
this defends against a large class of XSS-driven session theft.

**FIXED (previously a significant gap):** session revocation is now implemented.
`User.sessionVersion` is an integer embedded in every issued JWT and checked against the
current database value on every `getSession()` call (`lib/auth/session.ts`). Logging out
(`logoutUser()` in `services/auth.service.ts`) and changing password
(`app/api/settings/password/route.ts`) both bump `sessionVersion`, which instantly
invalidates every other outstanding token for that user on its next request — a
cryptographically valid, unexpired JWT with a stale `sessionVersion` is now correctly
rejected. Verified by `tests/integration/sessionRevocation.integration.test.ts`. Cost: one
extra indexed primary-key lookup per authenticated request — acceptable at current scale;
the documented next optimization if this becomes measurable is caching
`{userId: sessionVersion}` in Redis with a short TTL.

**Still a gap:** no refresh-token rotation — a single long-lived (7-day) token is used
directly rather than a short-lived access token + rotating refresh token pair. Acceptable
for the current scale, a real gap for a production financial product.

## Password handling

**Implemented correctly:** `bcryptjs.hash(plain, 12)` on registration and password change;
`bcryptjs.compare` on login and before allowing a password change
(`app/api/settings/password/route.ts` verifies `currentPassword` before accepting
`newPassword`). Minimum password policy enforced server-side via Zod (8+ characters, one
uppercase letter, one number — `lib/validation/auth.ts`).

**CURRENT GAP:** no check against known-breached password lists (e.g., a Have I Been
Pwned range check) and no password strength meter in the UI beyond the static policy text.

## Input validation

**Implemented:** every mutating API route validates its request body with a Zod schema
(`lib/validation/*.ts`) before it reaches the service layer or database — this is
consistent across all 25 routes, not selectively applied.

## SQL injection

**Not applicable / defended by construction.** There is zero raw SQL anywhere in this
codebase — every database access goes through Prisma Client's generated, parameterized
query builder. SQL injection is not possible through the application's own query
construction.

## XSS

**Implemented (by framework default):** React escapes all rendered text content by
default; no `dangerouslySetInnerHTML` is used anywhere in this codebase. Combined with the
`HttpOnly` session cookie, a successful script-injection would not be able to steal the
session token directly.

**CURRENT GAP:** no `Content-Security-Policy` header is configured (see
[Secure headers](#secure-headers)) — CSP would be defense-in-depth against any future
introduction of unsafe HTML rendering.

## CSRF

**Partially defended:** the session cookie is set with `SameSite=Lax`, which blocks the
cookie from being sent on cross-site `POST` requests initiated via top-level navigation
(e.g., a malicious `<form>` auto-submit on another site) but does **not** block same-site
`fetch`/XHR-based cross-origin requests in all browser configurations, and does not defend
against subdomain-based attacks if FinMate were ever deployed across multiple subdomains.

**CURRENT GAP:** no explicit CSRF token (double-submit cookie or synchronizer token
pattern) exists. **Fix:** for a single-origin app like this, the pragmatic fix is
verifying the `Origin`/`Referer` header on state-changing requests in addition to relying
on `SameSite`, or adopting a CSRF token for full defense-in-depth.

## CORS

**Not configured.** `next.config.js` sets no explicit CORS headers, and there is no
`Access-Control-Allow-Origin` anywhere in the codebase. Next.js Route Handlers same-origin
requests work by default; this is fine because FinMate has no external API consumers today.
**CURRENT GAP:** if a mobile app or third-party integration were ever added, explicit CORS
configuration would be required — currently undocumented and unconfigured.

## Sensitive data exposure

**Implemented:** `passwordHash` is never included in any API response — routes that return
`user` objects explicitly select `{ id, name, email }` rather than the full Prisma record
(see `app/api/auth/register/route.ts`, `app/api/auth/login/route.ts`).

**CURRENT GAP:** error responses in some routes could leak internal details if a raw
`Error` object were ever serialized directly to the client — current routes correctly
return `{ error: "Something went wrong." }` for unexpected errors in auth routes, but this
pattern is not verified consistently across all 25 routes (see `ERROR_HANDLING` gap in
`API.md`'s ownership-check discussion).

## Environment variables & secrets

**Implemented correctly:** `AUTH_SECRET` and `DATABASE_URL` are read from environment
variables via `process.env`, never hardcoded. `.env` is git-ignored (`.gitignore` includes
`.env` and `.env*.local`). `.env.example` contains only placeholder values, never real
secrets. `AUTH_SECRET` generation is explicitly documented as requiring `openssl rand
-base64 32` rather than shipping a default production secret.

## API abuse / rate limiting

**FIXED (previously the single biggest gap in this codebase):** rate limiting is now
implemented (`lib/security/rate-limit.ts`) — an in-memory token-bucket limiter, wired into
`/api/auth/login` (5 attempts per 5 minutes per client IP) and `/api/auth/register` (3
attempts per 15 minutes per client IP), returning `429` with a `Retry-After` header when
exceeded. Verified by `tests/rateLimit.test.ts`, which tests the bucket's refill behavior
and per-key isolation directly.

**Documented, honest scope limitation:** this limiter is in-memory and correct only for a
single application instance — the exact deployment shape FinMate's zero-cost hosting path
(one Vercel/Node instance) actually is. It does **not** share state across multiple
instances; horizontally scaling the app would require swapping this for a Redis-backed
limiter, a migration intentionally isolated to this one file (callers only interact with
`checkRateLimit()`, never the storage directly). See `docs/SYSTEM_DESIGN.md`'s 1M-user
design for where this fits in a larger-scale architecture.

**Still a gap:** every other endpoint (all authenticated routes) remains unrated-limited —
a deliberate scope decision, since the two auth endpoints are the ones exploitable without
already having a valid session, and were the highest-priority target for this pass.

## Logging

**CURRENT GAP:** logging is limited to ad hoc `console.error` calls in a few route
handlers' catch blocks (e.g., `app/api/auth/register/route.ts`) — there is no structured
logging, no request-ID correlation, and no centralized log aggregation or error-monitoring
service (Sentry, Datadog, etc.) integrated. A production incident would currently be
invisible unless someone is actively tailing server logs.

## Dependency vulnerabilities

**Not actively monitored.** No `npm audit` automation, no Dependabot/Renovate
configuration exists in the repository as of this audit. `npm audit` should be run
manually and periodically at minimum; ideally added to CI (see `docs/ROADMAP.md` — a
lightweight CI workflow is proposed in this same documentation pass).

## Secure headers

**FIXED:** `next.config.js` now sets a real `headers()` function applied to every route:
`X-Frame-Options: DENY` (clickjacking defense), `X-Content-Type-Options: nosniff`
(MIME-sniffing defense), `Referrer-Policy: strict-origin-when-cross-origin`,
`Permissions-Policy` restricting camera/microphone/geolocation (none of which FinMate
uses), and a baseline `Content-Security-Policy` (same-origin by default, `frame-ancestors
'none'`). Not present before this pass; verifiable by inspecting response headers on any
request once the app is running, or by reading `next.config.js` directly.

**A real bug found and fixed in this same feature:** the initial CSP's `script-src`
omitted `'unsafe-eval'`, which broke Next.js's own development server — the Fast
Refresh/webpack HMR runtime requires `eval()` to execute, and blocking it silently broke
client-side JavaScript execution across the entire app in `npm run dev` (concretely: this
surfaced as login/register form submit handlers appearing to not fire at all, which
initially looked like an unrelated auth bug). **Fix:** `'unsafe-eval'` is now included in
`script-src` only when `NODE_ENV !== "production"` — development keeps the relaxation Next.js
needs, while a production build (`next build && next start`, no Fast Refresh) keeps the
strict policy with no `'unsafe-eval'`. This is a good example of why security headers need
to be verified against the actual running app, not just written and assumed correct.

## User data isolation

**Implemented and verifiable.** This is the property most worth being able to defend
directly in an interview: every single Prisma query touching user-owned data — across
`transaction.service.ts`, `budget.service.ts`, `goal.service.ts`, `account.service.ts`,
`recurring.service.ts`, `notification.service.ts`, `insight.service.ts` — includes
`userId` in its `where` clause, sourced exclusively from the verified session (never from
client-supplied input). There is no code path in this application where a `userId` is
accepted from the request body or query string and trusted.

## Summary table

**Updated after a hardening pass** — see the note at the top of the relevant sections
below for what changed and why.

| Area | Status |
|---|---|
| Password hashing | ✅ Implemented (bcrypt, cost 12) |
| Session cookie flags | ✅ Implemented (HttpOnly, SameSite=Lax, Secure in prod) |
| User data isolation | ✅ Implemented and verified (now with integration tests — see docs/TESTING.md) |
| Input validation | ✅ Implemented (Zod on every mutating route) |
| SQL injection defense | ✅ Implemented (Prisma parameterized queries only) |
| XSS defense | ✅ Implemented (React default escaping, no raw HTML injection) |
| Rate limiting | ✅ Implemented (token-bucket, login + register, single-instance scope — see below) |
| Session revocation | ✅ Implemented (`sessionVersion`, bumped on logout/password change) |
| Security headers | ✅ Implemented (CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy) |
| CSRF token | ❌ CURRENT GAP (partially mitigated by SameSite=Lax — not upgraded in this pass) |
| Structured logging / monitoring | ❌ CURRENT GAP (not addressed in this pass) |
| Account lockout | ❌ CURRENT GAP (rate limiting reduces but does not fully replace this) |
| Dependency vulnerability scanning | ❌ CURRENT GAP (not automated) |
| Rate limiter multi-instance support | ⚠️ Documented limitation — in-memory only, needs Redis before horizontal scaling |
