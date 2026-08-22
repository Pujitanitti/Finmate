# FinMate — Behavioral Interview Questions (STAR Format)

Two kinds of answers below: **fully grounded** (based on something that actually happened
in this codebase, verifiable by the git history/code itself) and **templates** (the
codebase can't supply the personal/emotional context a strong STAR answer needs — these are
clearly marked `[CUSTOMIZE]` for you to fill in with your actual experience building this).

## Table of Contents
- [Difficult technical problem](#difficult-technical-problem)
- [Something broke](#something-broke)
- [A technical decision you disagreed with](#a-technical-decision-you-disagreed-with)
- [Learning something quickly](#learning-something-quickly)
- [A performance problem](#a-performance-problem)
- [A security concern](#a-security-concern)
- [A feature you would redesign](#a-feature-you-would-redesign)
- [What would you do differently](#what-would-you-do-differently)

---

## Difficult technical problem

**Fully grounded answer:**

> **Situation:** Tab navigation in FinMate felt noticeably slow — clicking from Dashboard
> to Transactions to Budgets had a visible lag and the whole interface seemed to "flash"
> on every click.
>
> **Task:** Find the actual cause and fix it properly — not paper over it with a loading
> spinner, which would have been the faster, worse fix.
>
> **Action:** I traced through the route structure and realized every one of the eight
> authenticated sections had its own separate `layout.tsx`, each independently calling a
> `requireUser()` function that hits the database to re-verify the session, and each
> rendering its own instance of the sidebar/topbar/theme provider. In Next.js App Router,
> navigating between routes that don't share a layout instance unmounts the old one and
> mounts a new one — so every single click was re-running a database query and rebuilding
> the entire UI shell from scratch, even though nothing about the shell had actually
> changed.
>
> **Result:** I consolidated all eight sections under one shared route-group layout
> (`app/(app)/layout.tsx`), so the session check runs exactly once per session and the
> shell stays mounted the entire time a user navigates around the authenticated app. Only
> the actual page content now re-renders on navigation.

**Possible follow-ups:** "How did you verify the fix actually worked?" → By confirming the
file structure change directly (one layout instead of eight) and that Sidebar/Topbar no
longer appear in the component tree as remounting on navigation; I don't have a formal
before/after benchmark number, and I wouldn't claim one that doesn't exist.

---

## Something broke

`[CUSTOMIZE]` — the codebase's git history doesn't preserve a "here's a bug I shipped and
had to fix in production" story, because this project was built and iterated on directly
rather than deployed with real users hitting a live bug. If you want a strong answer here,
consider: was there a moment during local development where something you built didn't
work as expected on first try (e.g., the account-balance-sync logic, or session cookies
not persisting correctly at first)? Structure it as:
- **Situation:** what you were building and what broke.
- **Task:** what you needed to fix and by when.
- **Action:** how you diagnosed and fixed it.
- **Result:** what changed, and what you'd do differently to catch it earlier next time.

---

## A technical decision you disagreed with

`[CUSTOMIZE — but here's a grounded starting point]`

Since this was a solo project, there's no literal "disagreed with a teammate" story
available — but there is a genuine internal disagreement worth describing: whether to use
an AI API for the Insights feature or build a rule-based engine instead. If you want to
frame this as an internal debate you resolved yourself:

> **Situation:** FinMate needed a "smart insights" feature, and the obvious, more
> impressive-sounding approach would have been to call an AI API with the user's
> transaction data.
>
> **Task:** Decide between that and a fully deterministic, rule-based approach.
>
> **Action:** I weighed cost (an AI API isn't free at any real usage volume, which
> conflicted with the project's zero-cost constraint), explainability (a rule-based system
> means every generated insight can be traced to an exact rule and exact data — genuinely
> important for a financial product, where an unexplainable claim about someone's money is
> a trust problem), and honesty (I didn't want to build something that looked like AI but
> wasn't, or vice versa — the UI explicitly states the engine is rule-based).
>
> **Result:** I built the rule-based engine, and I'm confident it was the right call for
> this specific product, even though it's the less "impressive-sounding" option on paper.

---

## Learning something quickly

`[CUSTOMIZE]` — think about which technology in this stack was newest to you when you
started (Prisma's `Decimal` handling? Next.js App Router's Server/Client Component model?
Framer Motion's `layoutId` shared-element transitions used in the sidebar's active-tab
indicator?). A strong answer names the specific unfamiliar concept, how you learned it
(reading docs, a specific example you studied, trial and error), and where it shows up
concretely in the code now (e.g., "the sidebar's animated active-tab pill uses Framer
Motion's `layoutId` prop, which I hadn't used before this project").

---

## A performance problem

**Fully grounded answer:** same story as [Difficult technical problem](#difficult-technical-problem)
above — the redundant-layout navigation slowness is both a technical-difficulty story and
a performance story, and can be told either way depending on what the interviewer is
probing for. If asked specifically to distinguish it from the "difficult problem" answer,
emphasize the *measurement* angle instead: **Situation/Task** are the same, but for
**Action**, emphasize that you specifically looked for redundant work (database queries,
component remounts) rather than assuming the fix was "add a cache" or "add a spinner" —
the real fix required understanding *why* the work was redundant, not just that the
UI felt slow.

---

## A security concern

**Fully grounded answer:**

> **Situation:** While writing the security documentation for this project, I did an
> honest audit of every authentication and authorization code path rather than just
> describing what I intended to build.
>
> **Task:** Identify real gaps, not just document the parts that work.
>
> **Action:** I found that there's no rate limiting anywhere in the API — meaning the
> login endpoint is brute-forceable as currently implemented — and that logging out only
> deletes the client-side cookie without any server-side session revocation, so a stolen
> token would remain valid for up to 7 days regardless of a password change.
>
> **Result:** Rather than hide these in the documentation, I labeled them explicitly as
> `CURRENT GAP` with a specific proposed fix for each, and prioritized them as the top P0
> items in the project roadmap. I think being able to say "here's exactly what's wrong and
> here's how I'd fix it" is a stronger signal than pretending a project has no security
> gaps.

---

## A feature you would redesign

**Fully grounded answer:**

> **Situation:** Every data-fetching component in FinMate — the transactions table, budget
> board, goals board, dashboard charts, and more — independently fetches its own data on
> mount with `useState` + `useEffect` + `fetch`, with zero sharing between them.
>
> **Task:** Recognize this as a real limitation, not just accept it because it "works."
>
> **Action:** I traced through how many independent fetch call-sites exist (11) and what
> the actual cost is — navigating away from the dashboard and back re-fetches everything
> from zero, even if nothing changed in between.
>
> **Result:** I documented this honestly as the single biggest frontend architectural gap
> rather than treating "it works" as sufficient, and I have a specific, scoped fix in mind
> (adopting TanStack Query for caching and deduplication, not a heavier global state
> library) rather than a vague "we should optimize this someday."

---

## What would you do differently

**Fully grounded answer:**

> If I rebuilt this project from scratch, I'd do two things differently from day one
> rather than retrofitting them later: adopt a data-fetching/caching library (TanStack
> Query) from the start instead of the plain `useState`/`fetch` pattern that's now spread
> across 11 components, and write API-level tests alongside each route as I built it
> rather than only testing the pure business-logic functions after the fact. Both are
> things I know exactly how to fix now — the value of having built it the first way is
> that I can point to *why* those choices matter, concretely, rather than reciting them as
> abstract best practices.
