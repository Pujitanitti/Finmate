# FinMate — Frontend Interview Questions

40+ questions, answered from the actual implementation in `app/`, `components/`, and `lib/`.

## Table of Contents
- [React & Component Architecture](#react--component-architecture)
- [State, Hooks, and Data Fetching](#state-hooks-and-data-fetching)
- [Forms & Validation](#forms--validation)
- [Rendering & Performance](#rendering--performance)
- [Responsive Design & Accessibility](#responsive-design--accessibility)
- [Styling & Theming](#styling--theming)

## React & Component Architecture

**1. How are components organized in this codebase?**
By concern: `components/ui/` holds design-system primitives (`Button`, `Card`, `Input`,
`Skeleton`, `EmptyState`) with no business logic; `components/layout/` holds app-shell
pieces (`Sidebar`, `Topbar`, `Shell`, `ToastProvider`); feature folders
(`components/transactions/`, `components/budgets/`, etc.) hold domain-specific components
that compose the primitives.

**2. What's the difference between Server and Client Components here, and how did you decide?**
Server Components (no `"use client"` directive) are the default — used for pages that only
need to fetch and display data (e.g., `app/(app)/dashboard/page.tsx` fetches the month
summary server-side). Client Components (`"use client"`) are used only where interactivity,
browser APIs, or React hooks are required — forms, modals, charts (Recharts needs the
browser), and anything using `useState`/`useEffect`.

**3. Give a concrete example of a Server Component in this app.**
`app/(app)/transactions/page.tsx` — it's an `async function` that calls
`prisma.account.findMany` and `prisma.category.findMany` directly (via `requireUser()` and
Prisma, not through the REST API) and passes the results as props to the Client Component
`TransactionsTable`.

**4. Why does `TransactionsTable` need to be a Client Component if the page itself is a Server Component?**
It manages local UI state (search text, filters, pagination page, modal open/closed) and
needs `useEffect` to re-fetch when those filters change — none of that is possible in a
Server Component.

**5. How is prop drilling avoided (or is it)?**
It isn't formally avoided — there's no Context API usage for domain data, and no global
store. Props are passed directly from page to component (e.g., `accounts`/`categories`
passed into `TransactionsTable`). This works because the component tree here is shallow;
it would become a real problem in a deeper tree, which is part of why a caching library
(TanStack Query) is the recommended next step rather than introducing Context as a
band-aid.

**6. What Context providers exist in this app?**
Two: `ThemeProvider` (`components/layout/theme-provider.tsx`) for dark/light mode state,
and `ToastProvider` (`components/layout/toast.tsx`) for the toast notification queue. Both
are genuinely cross-cutting concerns that justify Context — unlike domain data, which isn't
in Context.

**7. Walk me through the `Shell` component's structure.**
`Shell` wraps `ThemeProvider` → `ToastProvider` → a flex layout containing `Sidebar`,
`Topbar`, `PageTransition` (wrapping `children`), and `MobileNav`. It's rendered exactly
once by the shared `app/(app)/layout.tsx`, not per-page — this was a deliberate fix for a
real performance bug (see `PERFORMANCE.md`).

**8. How are reusable UI primitives designed for consistency?**
Each primitive (`Button`, `Card`, etc.) accepts a `className` prop merged via a `cn()`
helper (`clsx` + `tailwind-merge`) so callers can extend styling without fighting
specificity, plus typed variant props (e.g., `Card`'s `interactive`/`tint` props) for
common visual variations rather than ad hoc className strings scattered across call sites.

## State, Hooks, and Data Fetching

**9. What state management library is used?**
None — no Redux, Zustand, or Context for domain data. Every data-fetching component uses
local `useState` + `useEffect` + `fetch`. This is a deliberate, documented trade-off — see
`ENGINEERING_DECISIONS.md` #5.

**10. Walk me through a typical data-fetching component's pattern.**
```tsx
const [items, setItems] = useState<T[]>([]);
const [loading, setLoading] = useState(true);
useEffect(() => {
  fetch("/api/resource").then(r => r.json()).then(d => setItems(d.items)).finally(() => setLoading(false));
}, [/* dependencies like filters */]);
```
This exact pattern repeats across `TransactionsTable`, `BudgetBoard`, `GoalsBoard`,
`AccountsBoard`, `RecurringBoard`, `CashFlowChart`, `SpendingBreakdown`, and more.

**11. What's the actual cost of not having a shared cache?**
Concretely: navigating from Dashboard to Transactions and back re-fetches the cash-flow
chart, spending breakdown, health score, and insights preview from zero — even though
nothing changed. Named directly as the top frontend gap in `ARCHITECTURE.md`.

**12. Where is `useCallback` used, and why?**
`TransactionsTable`'s `load` function is wrapped in `useCallback` with `[page, search,
categoryId, type]` as dependencies, so it can safely be a `useEffect` dependency without
causing an infinite re-fetch loop from a new function reference on every render.

**13. Is `useMemo`/`React.memo` used anywhere?**
No — an honest gap, not a hidden optimization. At current component complexity this
hasn't caused a measured problem, but it also means no explicit re-render optimization has
been done anywhere in the codebase.

**14. How does the notification bell avoid fetching on every render?**
It fetches once in a `useEffect` with an empty dependency array on mount — `NotificationBell`
lives in the `Topbar`, which is part of the persistent `Shell`, so this fetch only happens
once per session (not once per page), directly benefiting from the shared-layout fix.

**15. How would you refactor the fetch pattern to reduce duplication?**
Extract a small custom hook, e.g. `useFetch<T>(url, deps)`, returning `{ data, loading,
error, refetch }` — would remove the ~6-line boilerplate repeated across ~11 components
without introducing a full caching library, as an incremental first step before (or instead
of) adopting TanStack Query.

## Forms & Validation

**16. How is form validation implemented?**
Client-side, forms use plain controlled `useState` objects (not `react-hook-form`, despite
it being a dependency) with `required` HTML attributes for basic UX hints; the authoritative
validation happens server-side via the same Zod schemas the API routes use.
**Note:** `react-hook-form` and `@hookform/resolvers` are installed dependencies but not
yet wired into the actual form components — a real inconsistency between what's installed
and what's used, worth naming directly if asked.

**17. What happens when a form submission fails validation server-side?**
The API route returns `400 { error: "<message>" }`; the client component catches this and
displays it inline (e.g., `TransactionFormModal`'s `error` state renders a
`text-destructive` paragraph above the submit button).

**18. How is the transaction form's account/category dropdown populated?**
Passed as props from the parent (fetched server-side by the page, or client-side by
`QuickAddTransaction` when opened from the header) rather than fetched inside the modal
itself — avoids a redundant fetch every time the modal opens from a page that already has
the data.

**19. How is optimistic UI handled?**
It isn't — every mutation waits for the server response, then calls the parent's `load()`
function to re-fetch the full list. A real, named gap; see `ROADMAP.md`.

**20. How does the `QuickAddTransaction` header button avoid unnecessary fetches?**
It lazily fetches accounts/categories only when clicked (inside `handleOpen`), not on
mount — so it adds zero requests during normal navigation for users who never use it.

## Rendering & Performance

**21. What was the actual navigation performance bug, and how did you find it?**
Eight separate `layout.tsx` files (one per section) each independently ran the session
database query and rendered a fresh `Shell` on every navigation. Diagnosed by examining
which components were being unmounted/remounted on route changes; fixed by consolidating
into one shared route-group layout (`app/(app)/layout.tsx`).

**22. How does Next.js decide what to re-render on navigation now?**
Because all eight sections now share one layout instance, only the `page.tsx` segment for
the target route re-renders — the `Shell` (sidebar, topbar, theme provider, notification
bell) stays mounted throughout.

**23. What's the `PageTransition` component, and does it slow anything down?**
A thin Framer Motion wrapper (`components/layout/page-transition.tsx`) applying a 180ms
fade/slide keyed by pathname — purely a CSS transition on already-loaded content, added
*after* the actual performance fix, not as a substitute for it.

**24. How is loading state communicated to the user?**
`Skeleton` placeholder components (`components/ui/skeleton.tsx`) — animated pulse blocks
shaped like the eventual content — replace plain "Loading…" text across every data-fetching
component, giving a more polished perceived-performance experience without actually
changing fetch speed.

**25. Are charts (Recharts) a performance concern?**
Not measured directly, but no memoization boundary exists between a chart's own internal
state (e.g., `CashFlowChart`'s selected time range) and re-renders triggered by parent
state changes — an honest, unoptimized area.

**26. How is code splitting handled?**
Entirely via Next.js App Router's automatic route-based splitting — no manual
`next/dynamic` lazy-loading has been added on top of that default behavior.

**27. Is bundle size monitored?**
No — no bundle analysis has been run or recorded. A real gap if asked "what's your bundle
size," the honest answer is "not measured yet."

## Responsive Design & Accessibility

**28. How is the mobile experience different from desktop?**
`Sidebar` is hidden below the `md` breakpoint; `MobileNav` (a fixed bottom tab bar,
`components/layout/mobile-nav.tsx`) replaces it, showing a curated 5-item subset of the
full 8-item navigation.

**29. How is dark mode implemented technically?**
CSS custom properties define every color token twice — once under `:root` (light) and once
under `.dark` (dark) in `app/globals.css`. `ThemeProvider` toggles the `.dark` class on
`document.documentElement` and persists the choice to `localStorage`.

**30. What accessibility features actually exist today?**
Semantic HTML elements, `<label>`-associated form inputs, and `aria-label` on icon-only
buttons (e.g., the theme toggle, notification bell). **Honest gap:** no `aria-live` region
for toast notifications, no documented keyboard-navigation testing, no color-contrast audit.

**31. How would you make the toast notifications accessible?**
Wrap the toast container in an `aria-live="polite"` region so screen readers announce new
toasts without stealing focus — not currently implemented.

**32. How are charts made accessible (or are they)?**
They aren't — Recharts renders to SVG with no explicit text alternative or table
fallback for screen-reader users. A real, named gap.

## Styling & Theming

**33. Why Tailwind CSS instead of CSS Modules or styled-components?**
Utility classes colocate styling with markup, avoiding context-switching to separate files;
no CSS-in-JS runtime cost. Full reasoning in `ENGINEERING_DECISIONS.md` #7.

**34. How are design tokens (colors, radii) defined?**
As HSL CSS custom properties in `app/globals.css` (`--primary`, `--success`, `--warning`,
`--destructive`, `--radius`, etc.), referenced from `tailwind.config.ts`'s `theme.extend`
so Tailwind utility classes like `bg-primary` resolve to the current theme's actual value.

**35. How does the `cn()` utility work?**
`clsx(inputs)` merges conditional class names, then `twMerge()` resolves Tailwind class
conflicts (e.g., a later `p-4` correctly overrides an earlier `p-2` instead of both
applying) — standard pattern for a Tailwind-based component library.

**36. How is visual consistency maintained across the category icon system?**
A single lookup table, `CATEGORY_ICON_MAP` (`lib/utils/category-icons.tsx`), maps a
category name to one Lucide icon and one color pairing, imported everywhere a category is
displayed (transactions table, budget cards, recurring payments, spending chart) — so the
same category always looks identical everywhere, defined in exactly one place.

**37. How would you test that the design system stays consistent as the app grows?**
Not currently tested — visual regression testing (e.g., Chromatic or Percy) would be the
concrete tool for this; not implemented, would be a P2 recommendation.

**38. What animation library is used, and is it used consistently?**
Framer Motion — used deliberately for the sidebar's sliding active-tab indicator (`layoutId`
shared-element transition), the Cash Flow range picker's segmented-control highlight, and
page transitions. Not used decoratively/randomly elsewhere.

**39. How would you add a component test for `Button`?**
React Testing Library: render with each `variant`/`size` prop combination and assert the
expected class names are present; render `disabled` and assert `onClick` does not fire on
click — none of this currently exists (see `TESTING.md`).

**40. What's the single frontend change you'd make first if given more time?**
Adopt TanStack Query to eliminate the redundant independent-fetch pattern across ~11
components — the highest-leverage frontend fix available, named consistently across
`PERFORMANCE.md`, `ROADMAP.md`, and `INTERVIEW_PREP.md`.
