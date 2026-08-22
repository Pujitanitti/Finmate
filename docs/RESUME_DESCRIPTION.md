# FinMate — Resume Project Description

No invented metrics anywhere below (no fake user counts, uptime percentages, or speed
claims) — only what's actually true of this codebase.

## 1-line version

**FinMate — a full-stack personal finance platform (Next.js, PostgreSQL, Prisma) with a
rule-based financial insights engine, built entirely on free infrastructure.**

## 2-bullet version

- Built FinMate, a full-stack personal finance app (Next.js 15, TypeScript, PostgreSQL,
  Prisma) with transaction/budget/goal tracking, dashboard analytics, and a service-layer
  architecture separating business logic from API routes.
- Diagnosed and fixed a navigation-performance issue caused by redundant per-route layouts
  by consolidating eight separate layouts into one shared route-group layout, eliminating
  unnecessary re-authentication and UI remounting on every navigation.

## 3-bullet FAANG-focused version

- Architected and built FinMate end-to-end — a full-stack personal finance platform
  (Next.js 15 App Router, TypeScript, PostgreSQL, Prisma) with a service-layer pattern
  that keeps all business logic (atomic account-balance updates, live budget-status
  computation, goal progress projection) independently testable and separate from HTTP
  route handling.
- Designed and implemented a fully rule-based financial insights engine and a transparent,
  weighted financial health score — deliberately avoiding a paid AI API dependency in
  favor of deterministic, explainable logic appropriate for a financial product; both are
  covered by unit tests verifying exact boundary conditions.
- Diagnosed a real navigation-performance regression to its root cause (redundant
  per-route layouts re-running session verification and remounting the UI shell on every
  click) and fixed it architecturally by consolidating routes under a shared layout, rather
  than masking the symptom with a loading indicator.

## STAR explanation

**Situation:** Most free personal-finance tools either require linking a bank account to a
third party, gate core functionality behind a paywall, or are too minimal to be genuinely
useful.

**Task:** Build a complete, real personal finance application — not a demo with fixture
data — that could run entirely on free infrastructure, with no paid API dependency
anywhere in the feature set.

**Action:** Designed a normalized PostgreSQL schema (14 models) with proper relational
integrity for financial data; built a Next.js App Router application with a clear
service-layer boundary between HTTP handling and business logic; implemented
authentication with bcrypt and signed JWT sessions; built a fully rule-based insights
engine and a transparent financial health score instead of relying on a paid AI API;
diagnosed and fixed a real navigation-performance bug by tracing it to its architectural
root cause rather than a superficial symptom.

**Result:** A fully working, end-to-end application with real (not mocked) authentication,
atomic financial-data consistency via database transactions, unit-tested core business
logic, and a documented, honest accounting of the project's actual gaps and next steps —
including areas like rate limiting and test coverage that are explicitly identified rather
than hidden.
