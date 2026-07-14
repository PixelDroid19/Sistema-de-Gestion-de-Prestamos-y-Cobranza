# Aligned Report Toolbar Design

## Objective

Remove the visible misalignment and unused vertical space in the desktop reports workspace without hiding report categories or adding navigation clicks.

## Root cause

The report selector owns a visible label row while the category controls do not, so the two control groups cannot share a baseline. Inside each report, export actions live in the heading row while the filter disclosure occupies a separate row even when collapsed. This leaves an otherwise empty band between the heading and the summary.

## Approved composition

- Keep the three report categories visible as direct controls.
- Keep the report type as a select, but visually hide its redundant label while preserving the associated accessible name.
- Give category controls and the select the same desktop height and align them on one baseline.
- Place the collapsed filter trigger in the same desktop action cluster as Excel and PDF.
- When filters open, render the filter fields across the full report width below the heading.
- Keep active filter chips immediately below the control row.
- Move the summary directly below the compact heading when filters are closed.
- Preserve the existing stacked layout below the desktop breakpoint.

## Architecture

`ReportsNavigation` remains responsible for category and report selection. `ReportTabPanel` owns the heading, export actions, filter disclosure, and active-filter chips. The filter disclosure becomes controlled by `ReportTabPanel` so its trigger can be placed in the heading action cluster while its panel can still span the report width.

No report query, export, financial calculation, permission, or backend contract changes.

## Interaction and accessibility

- The report selector retains a real `<label>` and accessible name; only its visual presentation changes.
- The filter trigger remains a native button with `aria-expanded` and `aria-controls`.
- Keyboard focus styles and current hover/selected states remain intact.
- Opening and closing filters must not shift or overlap export actions.

## Verification

- Regression tests verify one aligned navigation row and one report action cluster.
- Filter disclosure tests verify collapsed, expanded, active-chip, individual removal, and clear-all behavior.
- Full lint, type checking, frontend tests, backend tests, and production build run before publishing.
- Chrome validation uses the production desktop route, including console and network inspection.

## Data reset and deployment boundary

After the UI commit reaches `master`, deploy the frontend and backend from the same source revision. Reset only the `production` PostgreSQL schema through `backend/scripts/resetProductionEmptyDataset.js`, using its explicit confirmation variable. Recreate only:

- `qa.admin.20260519@test.local` (`admin`)
- `qa.employee.20260519@test.local` (`employee`)

Both accounts use the user-provided password. Verify both logins and verify that operational datasets are empty.
