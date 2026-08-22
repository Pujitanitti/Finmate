# FinMate — Engineering Decision Records

Every major decision below reflects an actual choice made in this codebase, not a
hypothetical. Format: Decision → Context → Options Considered → Decision Made → Why →
Trade-offs → Future Reconsideration.

## Table of Contents
1. [Framework: Next.js App Router monolith](#1-framework-nextjs-app-router-monolith)
2. [Database: PostgreSQL](#2-database-postgresql)
3. [ORM: Prisma](#3-orm-prisma)
4. [Authentication: custom bcrypt + JWT, not a third-party provider](#4-authentication-custom-bcrypt--jwt-not-a-third-party-provider)
5. [State management: no global store](#5-state-management-no-global-store)
6. [API design: REST, not GraphQL](#6-api-design-rest-not-graphql)
7. [Styling: Tailwind CSS](#7-styling-tailwind-css)
8. [Insights: rule-based, not an AI API](#8-insights-rule-based-not-an-ai-api)
9. [Monetary storage: Prisma Decimal](#9-monetary-storage-prisma-decimal)
10. [Route structure: shared layout via route group](#10-route-structure-shared-layout-via-route-group)
11. [Deployment: Vercel + free-tier managed Postgres](#11-deployment-vercel--free-tier-managed-postgres)
12. [Testing: Vitest + Playwright, not Jest](#12-testing-vitest--playwright-not-jest)

---

## 1. Framework: Next.js App Router monolith

**Context:** needed a frontend and a backend for a personal finance CRUD app with
real-time-feeling dashboards, at zero infrastructure cost.

**Options considered:** separate React SPA + Express/NestJS API; Next.js with a separate
backend service; Next.js App Router as a single full-stack application.

**Decision made:** Next.js 15 App Router, Route Handlers as the API layer, in one
repository and one deployable unit.

**Why:** a solo-built application with a handful of routes and no requirement for the
frontend and backend to scale or deploy independently gets no real benefit from a network
boundary between them, and pays a real cost in duplicated types, CORS configuration, and
two deployments to manage. Server Components also mean genuinely less client-side
JavaScript for data that's only ever read, not interacted with.

**Trade-offs:** the frontend and backend cannot be scaled or deployed independently; a
team split across frontend/backend specialists would find this repository structure less
natural than a clearly separated one.

**Future reconsideration:** if FinMate ever needed a genuinely separate consumer (a mobile
app, a public API for third parties), the Route Handlers would need to be extracted into
their own versioned API service at that point — the service layer (`services/*.ts`) was
kept framework-agnostic specifically so that extraction would be mechanical, not a rewrite.

## 2. Database: PostgreSQL

**Context:** needed to store financial data with real relational integrity — transactions
that must belong to exactly one account, budgets composed of category limits, foreign-key
relationships that must not silently break.

**Options considered:** MongoDB (document store), MySQL, PostgreSQL, SQLite.

**Decision made:** PostgreSQL.

**Why:** foreign-key constraints and multi-table transactional consistency (see
`prisma.$transaction` usage in `transaction.service.ts` and `goal.service.ts`) are
first-class, enforced-by-the-database features in Postgres — a document store would push
that consistency responsibility entirely into application code with no safety net.
Postgres's `NUMERIC`/`DECIMAL` type is also a genuinely better fit for money than most
alternatives, and free-tier managed Postgres (Neon, Supabase) satisfies the zero-cost
constraint just as well as a document database's free tier would.

**Trade-offs:** requires running migrations (`prisma migrate`) as the schema evolves,
versus a schemaless document store's flexibility; a relational schema is less convenient
for genuinely unstructured or highly variable-shape data — not a concern here, since every
FinMate entity has a fixed, well-understood shape.

**Future reconsideration:** none realistically — the data model is inherently relational;
no future feature under consideration would benefit from a document-store's flexibility
more than it would lose from giving up foreign-key integrity.

## 3. ORM: Prisma

**Context:** needed type-safe database access from TypeScript without hand-writing SQL for
every query, and needed a migration workflow.

**Options considered:** raw `pg` driver + hand-written SQL, Drizzle ORM, TypeORM, Prisma.

**Decision made:** Prisma.

**Why:** generates fully-typed query results directly from the schema (no manual type
definitions to keep in sync), has first-class `Decimal` support for monetary columns, and
its migration workflow (`prisma migrate dev`) is straightforward for a solo developer
without a DBA. The generated client also made the service-layer pattern (one file per
domain, e.g. `transaction.service.ts`) easy to keep consistent.

**Trade-offs:** Prisma's query builder is less flexible than raw SQL for genuinely complex
analytical queries — `services/budget.service.ts`'s per-item aggregate loop (documented as
a known inefficiency in `PERFORMANCE.md`) is an example of a query that would be a single
`GROUP BY` in raw SQL but requires either a loop or Prisma's less ergonomic `groupBy` API
in the ORM. Prisma also adds a build step (`prisma generate`) and a non-trivial dependency.

**Future reconsideration:** if a specific analytics query became a genuine bottleneck,
dropping to `prisma.$queryRaw` for that one query specifically (while keeping Prisma
everywhere else) is the pragmatic middle ground, rather than abandoning the ORM entirely.

## 4. Authentication: custom bcrypt + JWT, not a third-party provider

**Context:** needed secure user authentication without any paid dependency (Auth0, Clerk's
paid tiers, etc. all have free tiers with real limits).

**Options considered:** NextAuth.js/Auth.js with a credentials provider, a paid auth SaaS,
hand-rolled bcrypt + JWT session.

**Decision made:** hand-rolled — `bcryptjs` for password hashing, `jose` for signing a JWT
stored in an HttpOnly cookie.

**Why:** full control over the session model (cookie flags, expiry, what's embedded in the
token) with zero external dependency risk and zero cost regardless of usage volume. The
implementation surface is small enough (`lib/auth/password.ts`, `lib/auth/session.ts`) to
be fully understood and audited, versus depending on a larger library's internals.

**Trade-offs:** responsible for getting session security right without a library's
battle-tested defaults — the session-revocation gap documented in `SECURITY.md` is a direct
consequence of this choice; a mature auth library might have handled that out of the box.
No OAuth/social login exists as a result (not implemented, not currently needed).

**Future reconsideration:** if session revocation, refresh-token rotation, or OAuth
providers became requirements, migrating to Auth.js (which supports a custom credentials
provider alongside OAuth) would be more pragmatic than continuing to hand-roll those
features individually.

## 5. State management: no global store

**Context:** needed to manage UI and server-derived state across many independent feature
components (transactions, budgets, goals, etc.).

**Options considered:** Redux/Redux Toolkit, Zustand, React Query/TanStack Query, plain
`useState` + `fetch` per component.

**Decision made:** plain `useState` + `fetch` in `useEffect`, per component, with no shared
cache.

**Why:** at the current scope — a personal app with modest concurrent state complexity —
a global store adds real boilerplate and a new mental model without a data-sharing need
that justifies it; almost every piece of state in FinMate is genuinely local to the
component that fetches it (a transaction list doesn't need to be globally accessible to
the budget page).

**Trade-offs:** this is the most honestly costly decision in the codebase today — it
directly causes the "11 independent fetch call-sites, no deduplication" gap documented in
`ARCHITECTURE.md` and `PERFORMANCE.md`. Data fetched on the dashboard is not shared with
the same data if fetched again on another page.

**Future reconsideration:** this is the decision most worth revisiting first. Adopting
TanStack Query specifically (not a heavier global store) would solve the caching/dedup gap
without requiring a rewrite of the local-`useState` pattern — see `ROADMAP.md` P1.

## 6. API design: REST, not GraphQL

**Context:** needed an API layer between the client components and the service layer.

**Options considered:** GraphQL (single endpoint, client-specified queries), REST
(resource-oriented endpoints), tRPC (typed RPC without a schema language).

**Decision made:** REST, one Route Handler file per resource.

**Why:** the application has a small, well-understood set of resources with predictable
access patterns (list transactions, create a budget, etc.) — GraphQL's core benefit
(clients requesting exactly the fields they need, avoiding over/under-fetching) doesn't pay
for its setup and query-complexity cost at this scale. REST also maps directly and legibly
onto the service-layer functions with no additional schema-definition layer.

**Trade-offs:** some over-fetching does occur (e.g., `GET /api/goals` always returns the
full goal object with `progress`/`onTrack` computed, even if a caller only wanted the raw
list) — acceptable given the small response payloads involved.

**Future reconsideration:** tRPC would be worth evaluating if the API only ever needs to
serve this one first-party Next.js client, since it would remove the Zod-schema/route-glue
duplication between client and server more cleanly than plain REST does — genuinely a
close call, decided in favor of REST mainly for familiarity and debuggability (plain HTTP
requests are trivial to inspect in browser devtools; tRPC's wire format is less so).

## 7. Styling: Tailwind CSS

**Context:** needed a styling approach supporting a consistent design system, dark mode,
and rapid iteration without a large custom CSS file to maintain.

**Options considered:** CSS Modules, styled-components/Emotion (CSS-in-JS), plain global
CSS, Tailwind CSS.

**Decision made:** Tailwind CSS with CSS custom properties for theme tokens (see
`app/globals.css`'s `:root`/`.dark` variable definitions).

**Why:** utility classes colocate styling with markup (no context-switching to a separate
file for every small style decision), and using CSS custom properties for the actual color
values (rather than hardcoding hex codes in Tailwind config) meant dark mode could be
implemented as a single class toggle (`document.documentElement.classList.toggle("dark")`)
rather than duplicating every component's styles.

**Trade-offs:** utility-class-heavy JSX is genuinely less readable at a glance than
semantic class names for developers unfamiliar with Tailwind's conventions; no
CSS-in-JS runtime cost, but also no scoped/component-local styling escape hatch beyond
composing more utility classes.

**Future reconsideration:** none currently justified — the design system in
`components/ui/` already provides the reusable-component layer that would otherwise be
CSS-in-JS's main advantage.

## 8. Insights: rule-based, not an AI API

**Context:** wanted a "smart" insights feature (spending pattern observations, budget
warnings) without a paid AI API dependency (explicitly out of scope per the project's
zero-cost constraint).

**Options considered:** call OpenAI/Claude/Gemini with transaction data as context; build
a deterministic rule engine against real database aggregates.

**Decision made:** a fully deterministic rule engine (`services/insight.service.ts`) —
each "insight" is generated by an explicit, readable conditional (e.g., "if category
spend changed by ≥15% month-over-month, generate a message") against real
`analytics.service.ts` query results.

**Why:** zero ongoing cost regardless of usage volume, fully explainable output (every
insight can be traced to the exact rule and data that produced it — genuinely valuable for
a *financial* product, where an unexplainable AI-generated claim about someone's money is a
trust problem, not just a technical one), and no risk of a hosted AI model hallucinating a
financial claim.

**Trade-offs:** the insights are less flexible/novel than what a language model could
generate — they will never surface a pattern the rule author didn't anticipate. The UI is
explicit about this being rule-based (`app/(app)/insights/page.tsx` states directly: "The
FinMate Insights Engine is fully rule-based... No paid AI API is used") — a deliberate
honesty choice, not a limitation being hidden.

**Future reconsideration:** the service is structured so a real AI provider *could* be
added later as an optional, clearly-labeled enhancement layered on top of (not replacing)
the deterministic rules — but this was never implemented and is not required to work.

## 9. Monetary storage: Prisma Decimal

**Context:** money must never be stored with floating-point representation error.

**Options considered:** JS `number` (IEEE-754 float) columns, integer cents, Prisma
`Decimal`/Postgres `NUMERIC`.

**Decision made:** `Decimal(14, 2)` on every monetary column.

**Why:** Postgres's `NUMERIC` type stores exact base-10 decimal values, avoiding the
classic `0.1 + 0.2 !== 0.3` class of bug at the storage layer, without requiring the
application to convert every amount to/from integer cents manually (a common alternative
that trades storage-layer correctness for consistent-but-error-prone unit-conversion code
throughout the application).

**Trade-offs:** as documented honestly in `DATABASE.md`, storage-layer correctness does
not automatically extend to application-layer arithmetic — several service functions
convert `Decimal` to JS `number` before doing addition, which reintroduces float
imprecision in the calculation step even though the stored value is exact. This is a real,
acknowledged gap, not a claim that the current implementation is fully correct end-to-end.

**Future reconsideration:** using `Prisma.Decimal`'s own `.plus()`/`.minus()` methods
throughout the service layer (tracked as `ROADMAP.md` P0) would close this gap without
requiring a schema change.

## 10. Route structure: shared layout via route group

**Context:** eight authenticated sections each needed the same sidebar/topbar shell, but
were originally built with one `layout.tsx` per section.

**Options considered:** keep per-section layouts (the original structure); consolidate
into one shared layout via a Next.js route group.

**Decision made:** consolidated into `app/(app)/layout.tsx`, wrapping all eight sections.

**Why:** directly fixed a measurable navigation-performance problem — see
`PERFORMANCE.md` for the full write-up. This is the clearest example in the codebase of a
decision driven by diagnosing an actual reported symptom (slow tab switching) rather than
a decision made up front.

**Trade-offs:** none significant — this was a straightforward correctness fix once
diagnosed, not a trade-off-laden choice.

**Future reconsideration:** none — this is now the correct structure and should be the
pattern followed for any future authenticated section added to the app.

## 11. Deployment: Vercel + free-tier managed Postgres

**Context:** needed a deployment path satisfying the zero-cost constraint while remaining
production-plausible.

**Options considered:** self-hosted VPS, Vercel (Next.js's maintainer, generous free
Hobby tier), Railway/Render free tiers.

**Decision made:** Vercel for the application, Neon or Supabase (free-tier managed
Postgres) for the database — documented in the repository's `DEPLOYMENT.md`, with local
Docker Compose Postgres always available as a fallback that doesn't depend on any third
party's free-tier policy remaining unchanged.

**Why:** Vercel is built by the same team as Next.js and has first-class support for App
Router features (Server Components, Route Handlers) with zero configuration; free managed
Postgres tiers from Neon/Supabase avoid needing to self-manage a database server.

**Trade-offs:** free-tier limits (connection counts, compute hours, storage) are real
constraints that would need to be watched as usage grows, and are subject to the
provider's policy changes — explicitly why local Docker Compose is documented as the
always-available fallback rather than the cloud path being treated as guaranteed.

**Future reconsideration:** if usage genuinely outgrew free tiers, a self-hosted VPS with
Docker Compose (reusing the exact same `docker-compose.yml` already in this repository)
would be the natural next step before considering a more complex managed-infrastructure
setup.

## 12. Testing: Vitest + Playwright, not Jest

**Context:** needed a unit-test runner and an E2E framework.

**Options considered:** Jest + Testing Library + Cypress; Vitest + Testing Library +
Playwright.

**Decision made:** Vitest for unit tests, Playwright for E2E.

**Why:** Vitest shares configuration and transform pipeline conventions with the Vite
ecosystem generally and is noticeably faster than Jest for a TypeScript/ESM codebase like
this one, with a near-identical API making the choice low-risk. Playwright supports
multiple browser engines and has a more modern, less flaky auto-waiting model than Cypress
for the kind of full-page-navigation flows FinMate's E2E test exercises.

**Trade-offs:** Jest has a larger ecosystem of examples/Stack Overflow answers; Vitest's
relative newness means slightly less prior art to lean on when debugging an unusual test
failure.

**Future reconsideration:** none currently justified — both tools are working as intended
for the tests that exist; the gap is test *coverage*, not tooling (see `TESTING.md`).
