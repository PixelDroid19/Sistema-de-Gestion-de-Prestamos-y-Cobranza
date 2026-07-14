# Simplified Associate Creation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert associate creation into one clear desktop workflow with annual selected by default, an accessible annual/monthly choice, one first-payment date, and an immediate periodic-return summary.

**Architecture:** Keep submission orchestration in `NewAssociate.tsx` and extract date/return derivation into a pure `associateCreationTerms` module. Preserve the backend contract by translating the visible date into `interestPaymentDay` and `interestPaymentMonth`; do not add API fields or compatibility paths.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Testing Library, existing shared Surfaces controls and i18n dictionaries.

## Global Constraints

- Desktop is the primary surface; validate 1280×900 and 1440×1000.
- `Anual` is selected by default, while `Mensual` remains available.
- New associates are active without exposing a creation-time status control.
- Do not add dependencies, Tailwind configuration, backend fields, or legacy associate fields.
- Reuse shared inputs, buttons, surfaces, formatting, and i18n.
- Write behavior tests before production code and observe the expected failure.

---

### Task 1: Pure associate-creation financial terms

**Files:**
- Create: `frontend/src/lib/associateCreationTerms.ts`
- Create: `frontend/src/lib/associateCreationTerms.test.ts`

**Interfaces:**
- Produces: `AssociateInterestType`, `getDefaultFirstPaymentDate`, `getFirstPaymentDateBounds`, `getNextConfiguredPaymentDate`, `parseFirstPaymentTerms`, and `calculatePeriodicReturn`.
- Consumes: date-only strings and normalized numeric capital/rate values; no React state.

- [ ] **Step 1: Write failing tests for defaults, bounds, parsing, and calculation**

```ts
expect(getDefaultFirstPaymentDate('annual', new Date('2026-07-13T12:00:00Z'))).toBe('2027-07-13');
expect(getDefaultFirstPaymentDate('monthly', new Date('2026-07-13T12:00:00Z'))).toBe('2026-08-13');
expect(parseFirstPaymentTerms('2026-12-15')).toEqual({ day: '15', month: '12' });
expect(calculatePeriodicReturn(2_000_000, 12)).toBe(240_000);
expect(parseFirstPaymentTerms('2026-07-29')).toBeNull();
```

- [ ] **Step 2: Run tests and confirm RED**

Run: `cd frontend && npm test -- --run src/lib/associateCreationTerms.test.ts`

Expected: FAIL because `associateCreationTerms` does not exist.

- [ ] **Step 3: Implement date-only helpers**

Use UTC date arithmetic so date-only values do not drift by browser timezone. Clamp configured days to 28, return `YYYY-MM-DD`, set minimum to tomorrow, and set maximum/default to one month or one year after the operational date.

```ts
export type AssociateInterestType = 'annual' | 'monthly';
export type FirstPaymentTerms = { day: string; month: string };

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const formatDateOnly = (date: Date) => date.toISOString().slice(0, 10);
const addUtcDays = (date: Date, days: number) => {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
};
const toBogotaDateOnly = (now: Date) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day)));
};

export const getDefaultFirstPaymentDate = (
  interestType: AssociateInterestType,
  today = new Date(),
): string => {
  const base = toBogotaDateOnly(today);
  const due = new Date(base);
  due.setUTCDate(Math.min(base.getUTCDate(), 28));
  if (interestType === 'annual') due.setUTCFullYear(due.getUTCFullYear() + 1);
  else due.setUTCMonth(due.getUTCMonth() + 1);
  return formatDateOnly(due);
};

export const getFirstPaymentDateBounds = (
  interestType: AssociateInterestType,
  today = new Date(),
): { min: string; max: string } => ({
  min: formatDateOnly(addUtcDays(toBogotaDateOnly(today), 1)),
  max: getDefaultFirstPaymentDate(interestType, today),
});

export const parseFirstPaymentTerms = (value: string): FirstPaymentTerms | null => {
  const match = DATE_ONLY_PATTERN.exec(value);
  if (!match) return null;
  const [, yearText, monthText, dayText] = match;
  const date = new Date(Date.UTC(Number(yearText), Number(monthText) - 1, Number(dayText)));
  if (formatDateOnly(date) !== value || Number(dayText) > 28) return null;
  return { day: String(Number(dayText)), month: String(Number(monthText)) };
};

export const calculatePeriodicReturn = (capital: number, rate: number): number => (
  Math.round((capital * rate / 100) * 100) / 100
);
```

- [ ] **Step 4: Run helper tests and confirm GREEN**

Run: `cd frontend && npm test -- --run src/lib/associateCreationTerms.test.ts`

Expected: all helper tests pass.

### Task 2: Creation behavior and accessible frequency choice

**Files:**
- Modify: `frontend/src/components/__tests__/NewAssociate.behavior.test.tsx`
- Modify: `frontend/src/components/NewAssociate.tsx`
- Modify: `frontend/src/i18n/dictionaries/terms-es/associates.ts`
- Modify: `frontend/src/i18n/dictionaries/terms-en/associates.ts`

**Interfaces:**
- Consumes: all Task 1 helpers.
- Produces: creation form state with `firstPaymentDate`; the service payload remains the existing associate contract.

- [ ] **Step 1: Replace obsolete creation assertions with failing behavior tests**

Add assertions that creation defaults to annual, hides status, shows two named frequency radio options, prepopulates the next annual date, and has no duplicate Cancel action.

```tsx
expect(screen.getByRole('radio', { name: 'Anual' })).toBeChecked();
expect(screen.getByRole('radio', { name: 'Mensual' })).not.toBeChecked();
expect(screen.queryByLabelText('Estado')).not.toBeInTheDocument();
expect(screen.queryByRole('button', { name: 'Cancelar' })).not.toBeInTheDocument();
expect(screen.getByLabelText('Primer pago')).toHaveValue(expectedAnnualDate);
```

Add a test that fills capital and rate, verifies `Recibirá COP 240.000 cada año`, changes to monthly, and verifies the label/date/summary update without an additional step.

- [ ] **Step 2: Run component tests and confirm RED**

Run: `cd frontend && npm test -- --run src/components/__tests__/NewAssociate.behavior.test.tsx`

Expected: FAIL because the existing form defaults to monthly, renders a status select, uses frequency/day selects, and has no live summary.

- [ ] **Step 3: Implement the simplified creation state and presentation**

Change `EMPTY_FORM.interestType` to `annual`, add `firstPaymentDate`, derive date bounds during render, and use a native fieldset/radio group styled as a two-option selector.

```tsx
<fieldset className="associate-frequency" aria-describedby="associate-frequency-help">
  <legend>{tTerm('newAssociate.field.interestType')}</legend>
  {(['annual', 'monthly'] as const).map((type) => (
    <label key={type} className="associate-frequency__option">
      <input
        type="radio"
        name="associate-interest-type"
        value={type}
        checked={formData.interestType === type}
        onChange={() => selectInterestType(type)}
      />
      <span>{type === 'annual' ? tTerm('common.interestType.annual') : tTerm('common.interestType.monthly')}</span>
    </label>
  ))}
</fieldset>
```

On frequency change, replace the first-payment date with the next valid default. Render `AppInput variant="date"` with `min`/`max`; hide status only when creating. Remove the lower Cancel button outside embedded edit mode.

- [ ] **Step 4: Translate date to the existing payload and render the summary**

Validate the date against the current bounds and use `parseFirstPaymentTerms`. Submit `status: 'active'` for creation; use the selected edit status when editing. For monthly payloads set `interestPaymentMonth: '1'`; for annual payloads use the parsed month.

Compute the summary from normalized capital and rate and format it with the existing `formatCurrency` and `formatDate` functions.

```tsx
<div className="associate-return-preview" aria-live="polite" data-tour="new-associate-preview">
  <p>{tTerm(periodicReturnKey, { amount: formatCurrency(periodicReturn) })}</p>
  <p>{tTerm('newAssociate.preview.firstPayment', { date: formatDate(formData.firstPaymentDate) })}</p>
</div>
```

- [ ] **Step 5: Run component tests and confirm GREEN**

Run: `cd frontend && npm test -- --run src/components/__tests__/NewAssociate.behavior.test.tsx`

Expected: all NewAssociate behavior tests pass.

### Task 3: Focused desktop styling and edit regression

**Files:**
- Modify: `frontend/src/index.css`
- Modify: `frontend/src/components/__tests__/NewAssociate.behavior.test.tsx`

**Interfaces:**
- Consumes: semantic class names from Task 2.
- Produces: a compact single-surface desktop layout with visible focus and no nested decorative card structure.

- [ ] **Step 1: Add failing edit and accessibility assertions**

Verify the frequency controls are native radios inside a named group, creation has one bottom action, and edit mode still exposes Estado and initializes its next configured date from persisted day/month values.

- [ ] **Step 2: Run component tests and confirm RED**

Run: `cd frontend && npm test -- --run src/components/__tests__/NewAssociate.behavior.test.tsx`

Expected: new edit assertions fail until edit derivation and conditional actions are complete.

- [ ] **Step 3: Add scoped styling**

Create only `.associate-new-page`, `.associate-frequency`, `.associate-frequency__option`, and `.associate-return-preview` rules. Use existing CSS variables, 12–14px radii, no gradient/shadow decoration, a three-column contact row at desktop, and `:focus-visible` on the selectable options. Keep the embedded edit form compatible with its modal width.

- [ ] **Step 4: Run focused tests, TypeScript, and build**

Run:

```bash
cd frontend
npm test -- --run src/lib/associateCreationTerms.test.ts src/components/__tests__/NewAssociate.behavior.test.tsx
npm run lint
npm run build
```

Expected: all commands exit 0.

### Task 4: Real workflow QA and repository verification

**Files:**
- No committed browser artifacts.

**Interfaces:**
- Consumes: completed frontend behavior.
- Produces: browser evidence for the accepted desktop flow.

- [ ] **Step 1: Run the local application and open `/associates-new`**

Run `npm run dev:local`. Use the Browser plugin when callable; if its known runtime setup fails, record the exact failure and use the already-available local browser automation fallback.

- [ ] **Step 2: Verify annual and monthly interaction paths**

At 1440×1000 and 1280×900, verify page identity, annual default, radio keyboard operation, date bounds, live return calculation, payload-triggering submission with realistic data, and preserved form state on a forced failure.

- [ ] **Step 3: Inspect console and network**

Confirm no framework overlay, relevant console errors/warnings, duplicate create request, clipping, overlap, or horizontal overflow.

- [ ] **Step 4: Run full verification and review the diff**

Run:

```bash
npm run lint
npm test
cd frontend && npm run build
git diff --check
git status --short
```

Expected: all suites pass; only intentional source/docs changes plus the pre-existing untracked `tmp/` remain.

- [ ] **Step 5: Commit and push master**

Stage only the associate flow, tests, i18n, styling, helper, and plan. Commit with a scoped Conventional Commit message and push `master` after confirming `HEAD` and `origin/master` synchronize.
