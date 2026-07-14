# Associate Frequency States Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the annual/monthly frequency selector communicate normal, hover, focus, active, and selected states clearly, with annual selected by default.

**Architecture:** Preserve the existing semantic radio group and form state in `NewAssociate.tsx`. Scope the visual correction to the existing associate-frequency CSS classes and protect the state contract with focused Vitest assertions; no API or domain changes are required.

**Tech Stack:** React 19, TypeScript, CSS variables, Vitest, Testing Library.

## Global Constraints

- Work on `master` without creating a temporary branch, per the user's delivery instruction.
- `Anual` remains selected by default and `Mensual` remains selectable in one action.
- The selected state must not rely only on a bottom border.
- Normal, hover, active, selected, and keyboard-focus states must be visually distinct.
- Reuse the current semantic fieldset and native radio inputs.
- Do not add dependencies or change backend, payload, or financial behavior.

---

### Task 1: State contract and segmented-control styling

**Files:**
- Modify: `frontend/src/components/__tests__/associateFrequencyStyles.test.ts`
- Modify: `frontend/src/index.css`

**Interfaces:**
- Consumes: `.associate-frequency__option` and `.associate-frequency__option--selected` already emitted by `NewAssociate.tsx`.
- Produces: visible hover, active, selected, and `:focus-within` styling without changing component state.

- [x] **Step 1: Write failing CSS-contract tests**

Assert that the base option declares a transition, the unselected option has a hover rule, the pressed interaction has an active rule, the selected rule has both a background and an inset shadow, and keyboard focus uses a visible outline.

- [x] **Step 2: Run the focused test and verify RED**

Run: `cd frontend && npm test -- --run src/components/__tests__/associateFrequencyStyles.test.ts`

Expected: FAIL because the current control has no hover/active rule, the selected state lacks pressed depth, and focus is only a bottom line.

- [x] **Step 3: Implement the state styles**

Use the existing design tokens. Give the group a quiet neutral track; keep normal options transparent; use a subtle surface on hover; use a tinted inset pressed treatment for the selected option; compress the active option slightly; and draw a complete focus ring around the keyboard-focused segment.

- [x] **Step 4: Run the focused tests and verify GREEN**

Run: `cd frontend && npm test -- --run src/components/__tests__/associateFrequencyStyles.test.ts src/components/__tests__/NewAssociate.behavior.test.tsx`

Expected: both suites pass, including annual default and monthly switching behavior.

### Task 2: Automated and rendered verification

**Files:**
- No additional production files.

**Interfaces:**
- Consumes: completed selector styles and existing associate form behavior.
- Produces: build and desktop-browser evidence for both selected states.

- [x] **Step 1: Run frontend checks**

Run: `cd frontend && npm run lint && npm run build`

Expected: both commands exit 0.

- [x] **Step 2: Validate the real workflow**

Open `/associates-new` at 1440x1000 and 1280x900. Verify annual is selected on first render, hover is visible on monthly, clicking monthly moves the selected treatment, keyboard focus is visible, and no layout shift or malformed borders appear.

- [x] **Step 3: Inspect runtime health**

Confirm page identity, meaningful DOM, no framework overlay, no relevant console warnings/errors, and no failed request caused by the interaction.

- [ ] **Step 4: Review and publish**

Review the focused diff, commit it on `master`, push `origin/master`, and preserve unrelated untracked files.
