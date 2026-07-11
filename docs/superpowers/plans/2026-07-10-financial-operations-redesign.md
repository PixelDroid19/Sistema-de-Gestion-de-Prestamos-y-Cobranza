# Financial Operations Redesign Implementation Plan

**Goal:** Make associates, analytics, and reports operate as one coherent capital-and-agreed-profitability workflow, with fixed financial definitions and restrained responsive UI.

## 1. Analytics read model

- Extend the dashboard repository with current associate capital and unpaid obligations.
- Replace the generic dashboard response with explicit `position`, `period`, `risk`, and `trend` sections.
- Add backend behavior coverage for every formula and the empty/error path.

## 2. Operational analytics UI

- Replace draggable/hideable widgets with fixed sections for current position, period operation, risk, and trend.
- Reuse page, section, action, empty-state, currency, and chart primitives.
- Use neutral surfaces and dividers; reserve semantic color for risk and negative results.
- Add responsive behavior coverage so critical metrics cannot disappear.

## 3. Associate detail information architecture

- Separate the detail into Summary, Capital, Profitability, and Calendar views.
- Keep capital contributions, reinvestments, capital returns, scheduled interest, and manual profitability visibly distinct.
- Reduce the summary to decision-relevant metrics and remove decorative multi-color accents.
- Preserve the payment contract of actual payment date and payment method only.

## 4. Reports reconciliation

- Add associate movements as an operational report using the canonical associate read model/export.
- Keep report filters, visible rows, totals, Excel, and PDF terminology aligned.
- Verify removed proportional/participation terminology does not return through UI, API, or exports.

## 5. Verification

- Run focused backend and frontend behavior tests while implementing.
- Run full lint, backend/frontend tests, and production build.
- Exercise login, associate creation, obligation payment, associate detail, dashboard, reports, and mobile creation in a real local browser.
- Inspect console, responsive overflow, Excel/PDF output, and final legacy-term searches.
