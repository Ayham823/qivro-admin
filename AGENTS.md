# Qivro Admin Agent Instructions

## Ownership

This repository is the only Qivro Admin application. Do not add Admin routes,
dependencies, Docker jobs, or source under `../frontend`.

## Architecture

- `src/app/`: guarded operations routes.
- `src/components/`: shared shell, states, dialogs, tables, and operations UI.
- `src/lib/admin-navigation.ts`: navigation and command-palette source of truth.
- `src/lib/api/`: focused backend API clients.
- `src/lib/api.ts`: compatibility export barrel.
- `src/lib/auth.ts`: client session helpers. Backend ADMIN guards remain authoritative.

## Safety

- Never treat hidden navigation or a client redirect as authorization.
- Never expose credentials, provider secrets, signed URLs, or private user data.
- Preserve unrelated dirty changes and inspect the current diff before editing.
- Do not add public `NEXT_PUBLIC_*` variables for secrets.
- Keep destructive actions explicit, confirmed, audited, and backed by backend checks.

## Change Rules

- Reuse the guarded shell and existing operations components.
- Add endpoint wrappers to the narrowest API module.
- Keep pages focused on orchestration and view state.
- Provide loading, empty, partial-error, stale-data, and permission states.
- Keep keyboard, mobile-table, and reduced-motion behavior intact.
- Propose new dependencies and wait for explicit approval before installation.

## Verification

Use Node 20 and run:

```bash
npm run lint
npm run build
git diff --check
```
