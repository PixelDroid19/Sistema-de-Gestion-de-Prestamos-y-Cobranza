# Repository Guidelines

## Project Structure & Module Organization

This is a fullstack monorepo for CrediCobranza, an internal credit and collections backoffice.

- `frontend/`: React + Vite app. Main screens live in `frontend/src/components/`, shared UI in `frontend/src/components/shared/`, services in `frontend/src/services/`, and i18n terms in `frontend/src/i18n/`.
- `backend/`: Node.js + Express API. Runtime starts at `backend/src/server.js`; modular domains live under `backend/src/modules/<domain>/`.
- `backend/tests/` and `frontend/src/components/__tests__/`: backend and frontend behavior tests.
- `backend/src/db/`: database migrations, seeds, and schema-related helpers.

Keep backend domain work inside `backend/src/modules/<domain>/...`; do not add root-level controller or service folders.

## Build, Test, and Development Commands

- `npm run install:all`: install frontend and backend dependencies.
- `npm run dev:local`: start local Postgres, backend, and frontend.
- `npm run docker:db` / `npm run docker:stop`: start or stop only the local database.
- `npm run lint`: run backend ESLint and frontend TypeScript checks.
- `npm run test`: run backend Node tests and frontend Vitest tests.
- `cd frontend && npm run build`: build the production frontend bundle.
- `cd backend && NODE_ENV=test node --require module-alias/register --test`: run the full backend test suite.

## Coding Style & Naming Conventions

Use existing patterns before introducing new abstractions. Backend code is CommonJS and uses `@/` module aliases from `backend/src`; same-directory imports should stay relative. Frontend code is TypeScript/React with shared components, services, and i18n helpers. New user-facing text must go through i18n. Reuse shared inputs, tables, modals, formatting helpers, and permission guards instead of one-off UI.

## Testing Guidelines

Backend tests use Node's built-in test runner. Frontend tests use Vitest and Testing Library. Name behavior tests with `.test.js`, `.test.ts`, or `.behavior.test.tsx`. For financial logic, permissions, reports, exports, credit calculations, payments, and capital prepayments, add focused tests and run the relevant full suite before merging.

## Commit & Pull Request Guidelines

Recent commits use concise Conventional Commit-style messages, for example `fix(credits): preview capital payments through backend`. Keep commits scoped by feature or bug. Pull requests should include a short summary, validation commands run, screenshots for UI changes, and notes about migrations, config changes, or data-impacting behavior.

## Security & Configuration Tips

Do not commit secrets. Local backend config uses `DB_*`, `JWT_SECRET`, and `ALLOWED_ORIGINS`; frontend API proxy uses `VITE_API_URL` as the backend origin, not `/api`. Do not reset databases or deploy to Railway unless the target environment and data impact are explicit.
