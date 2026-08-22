# FinMate — "Why Did You Do This?" Questions

Every technology below is actually used in this codebase. Full context for each is in
`ENGINEERING_DECISIONS.md`; this document is the rapid-fire Q&A version.

## Why React?

**Why React?** Component-based UI with a large ecosystem, and Next.js (built on React) was
the framework decision that mattered more — React came with that choice.
**Why not Vue/Svelte?** No strong reason to move away from React specifically; it wasn't a
close call for this project — familiarity and Next.js's tight React integration decided it.
**Trade-offs:** React's re-render model requires more explicit optimization (memoization)
than Svelte's compile-time reactivity — not yet needed at this app's current complexity.
**When would you change it?** Not for this project's scope; would reconsider only if
starting a new project with different constraints (e.g., a team already fluent in Vue).

## Why Next.js specifically, not plain React + a separate backend?

**Why Next.js?** One deployable unit for a solo-built app with no requirement for frontend
and backend to scale or deploy independently — see full reasoning in
`ENGINEERING_DECISIONS.md` #1.
**Why not Remix?** Not seriously evaluated — Next.js App Router's Server Components model
and the free-tier Vercel hosting story were both strong enough reasons to not need a
comparison.
**Trade-offs:** Coupling frontend and backend into one deployable means they can't scale
independently — a non-issue at this project's actual traffic.
**When would you change it?** If FinMate needed a genuinely separate consumer (mobile app,
third-party API access), the service layer's framework-agnostic design was deliberately
kept extractable for exactly that scenario.

## Why PostgreSQL, not MongoDB?

**Why Postgres?** Foreign-key constraints and multi-table transactional consistency are
first-class database features, essential for financial data with real relational
structure — see `ENGINEERING_DECISIONS.md` #2.
**Why not MongoDB?** A document store would push referential integrity entirely into
application code with no database-level safety net — the wrong trade for data this
interrelated (a transaction must belong to exactly one account and one user, always).
**Trade-offs:** Requires running schema migrations as the data model evolves, versus a
schemaless store's flexibility — acceptable since FinMate's entities all have fixed,
well-understood shapes.
**When would you change it?** If a future feature needed genuinely unstructured,
variable-shape data (unlikely for a personal finance app) — not the case for anything
currently planned.

## Why Prisma, not raw SQL or a different ORM?

**Why Prisma?** Type-safe queries generated directly from the schema, first-class
`Decimal` support for money, and a workable solo-developer migration workflow.
**Why not raw SQL / Drizzle / TypeORM?** Raw SQL loses type safety and requires
hand-maintaining types in sync with the schema; TypeORM's decorator-heavy API and less
mature migration tooling were less appealing than Prisma's schema-first approach.
**Trade-offs:** Less flexible than raw SQL for complex analytical queries — see the known
N+1-shaped inefficiency in `services/budget.service.ts`, documented honestly rather than
hidden.
**When would you change it?** Would drop to `prisma.$queryRaw` for a specific query that
became a genuine bottleneck, while keeping Prisma everywhere else — not a wholesale switch.

## Why this folder structure (service layer separate from routes)?

**Why a `services/` layer?** Keeps business logic testable and reusable independent of
HTTP — Server Components call service functions directly; Route Handlers call the same
functions after validating a request.
**Why not put logic directly in route handlers?** Route handlers would then need to be
imported and called from Server Components too, awkwardly, or logic would be duplicated
between the two call paths.
**Trade-offs:** One more layer of indirection to navigate when reading the code for the
first time.
**When would you change it?** Wouldn't — this is the part of the architecture I'd defend
most confidently as unambiguously correct for this shape of application.

## Why this authentication mechanism (hand-rolled bcrypt + JWT), not NextAuth/Clerk?

**Why hand-rolled?** Full control and full understanding of the exact session model
(cookie flags, expiry, JWT payload contents), zero cost at any usage volume, zero external
dependency risk.
**Why not NextAuth.js?** A legitimate, close alternative — NextAuth's credentials provider
would have done most of the same thing with less code to maintain, at the cost of
depending on a library's internals rather than fully understanding every line.
**Trade-offs:** Responsible for getting session security right without a mature library's
tested defaults — directly why the session-revocation gap exists today (see
`SECURITY.md`).
**When would you change it?** If OAuth/social login or refresh-token rotation became real
requirements, migrating to Auth.js would be more pragmatic than continuing to hand-roll
those features individually.

## Why REST, not GraphQL or tRPC?

**Why REST?** A small, well-understood set of resources with predictable access patterns —
GraphQL's core benefit (avoiding over/under-fetching via client-specified queries) doesn't
pay for its setup cost at this scale.
**Why not tRPC?** A genuinely close call — tRPC would remove some Zod-schema/route-glue
duplication, but plain REST's requests are trivially inspectable in browser devtools during
debugging, which mattered more for a solo developer than tRPC's added type-inference
convenience.
**Trade-offs:** Some over-fetching occurs (e.g., `GET /api/goals` always returns computed
`progress`/`onTrack` even if unneeded) — acceptable given small payload sizes.
**When would you change it?** Would evaluate tRPC more seriously if this API only ever
needed to serve exactly one first-party Next.js client long-term (which is currently true,
making it a legitimate open question rather than a settled one).

## Why this state management approach (no Redux/Zustand)?

**Why no global store?** Most state in FinMate is genuinely local to the component that
fetches it — a global store would add real boilerplate without a data-sharing need that
justifies it.
**Why not Redux Toolkit?** Would be meaningful overkill for state that's almost entirely
"data fetched by this component, for this component."
**Trade-offs:** This is the most honestly costly decision in the codebase — it directly
causes the 11-independent-fetch-call-sites, no-deduplication gap.
**When would you change it?** Already decided — TanStack Query (not a heavier global
store) is the named next step, specifically because the actual problem is caching/dedup,
not cross-component state sharing, which is what Redux/Zustand solve for.

## Why this UI architecture (design-system primitives + feature folders)?

**Why this structure?** `components/ui/` primitives with no business logic, composed by
feature-specific components — keeps the design system reusable and prevents styling
decisions from being duplicated across every feature.
**Why not a component library (shadcn/ui, MUI)?** A deliberate choice to build a small,
exactly-fitted primitive set rather than pull in a larger library with more surface area
than this project needs — a legitimate trade-off either way; this one favored minimalism.
**Trade-offs:** More upfront work than adopting a pre-built library; fewer components
available "for free" if a new UI pattern is needed later.
**When would you change it?** If the design system's surface area grew significantly
(many more component types, more complex interaction patterns), adopting shadcn/ui as a
foundation (which is itself just Tailwind + Radix primitives, compatible with this
project's existing styling approach) would be a reasonable next step.

## Why this deployment approach (Vercel + free-tier Postgres)?

**Why Vercel?** Built by the Next.js team, first-class support for App Router features
with zero configuration, generous free Hobby tier.
**Why not self-hosted?** Would require managing server infrastructure directly — more
control, more operational burden, not justified at this project's current scale.
**Trade-offs:** Subject to the provider's free-tier policy changes — explicitly why local
Docker Compose Postgres is documented as the always-available fallback, not treating the
cloud path as guaranteed.
**When would you change it?** If usage genuinely outgrew free tiers, a self-hosted VPS
reusing the existing `docker-compose.yml` would be the natural next step before more
complex managed infrastructure.

## Why store money as Decimal instead of integer cents?

**Why `Decimal(14,2)`?** Postgres's `NUMERIC` type stores exact base-10 values without
requiring the application to manually convert every amount to/from integer cents.
**Why not integer cents (a common alternative)?** Would also solve floating-point
precision, at the cost of consistent unit-conversion code throughout the application
(every display, every input, every calculation needs to know "this is cents, divide by
100") — `Decimal` avoids that class of bug entirely by keeping the stored unit the same as
the displayed unit.
**Trade-offs:** As documented honestly in `DATABASE.md`, storage-layer correctness doesn't
automatically extend to service-layer arithmetic — several functions convert to JS
`number` before computing, reintroducing float imprecision in the calculation step.
**When would you change it?** The fix (using `Prisma.Decimal`'s own arithmetic methods
throughout) doesn't require changing the storage decision — it requires fixing the
service-layer code to match the storage layer's correctness, tracked as `ROADMAP.md` P0.

## Why a fully rule-based Insights Engine instead of an AI API?

**Why rule-based?** Zero ongoing cost, fully explainable output (every insight traceable
to an exact rule and exact data), and no risk of a hosted model hallucinating a financial
claim.
**Why not call OpenAI/Claude/Gemini?** Explicitly out of scope for the project's zero-cost
constraint, and a deliberate product-trust decision beyond just cost — see
`ENGINEERING_DECISIONS.md` #8.
**Trade-offs:** Less flexible/novel than what a language model could generate — will never
surface a pattern the rule author didn't anticipate.
**When would you change it?** The service is structured so a real AI provider could be
layered on top later as a clearly-labeled optional enhancement — never implemented, never
required for the feature to work.
