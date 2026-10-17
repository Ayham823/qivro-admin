# Qivro Admin Command Center

Standalone, admin-only Next.js application for operating Qivro. Its source,
dependencies, Dockerfile, environment contract, and CI workflow are separated
from the public frontend and versioned in its own Git repository.

## Capabilities

- Founder command center with live business, AI, queue, and platform signals
- Listings, users, leads, payments, moderation, audit, and exports
- AI usage, evaluation, review queue, ranking, experiments, and search quality
- 3D tour pipeline and worker visibility
- System health plus configured links to GA4, PostHog, Sentry, Grafana,
  CloudWatch, GitHub, AWS, and Stripe
- Shared application shell with environment awareness, authenticated admin
  identity, quick actions, and searchable command palette

## Application Structure

```text
admin/
|-- src/app/                    # One route per operating area
|-- src/components/             # Shared shell, dashboards, tables, states
|-- src/lib/admin-navigation.ts # Single source of truth for admin navigation
|-- src/lib/api/                # Focused typed backend API clients
|-- src/lib/api.ts              # Compatibility export barrel
|-- Dockerfile
|-- .github/workflows/          # Independent CI and image build
`-- README.md
```

The public product does not import this application. Admin authorization is
verified against `GET /auth/me`, and the backend remains the source of truth for
all privileged data and mutations.

Admin browser sessions use the Backend-issued HttpOnly cookie. JWTs must not be
persisted in localStorage; Bearer tokens remain an API and automation
compatibility path only.

Local dev:

```bash
npm run dev
```

Default app port: `3002`. Docker development publishes it at `3012`.

Required env:

```env
NEXT_PUBLIC_API_URL=http://localhost:3201/api
NEXT_PUBLIC_BROWSER_API_URL=http://localhost:3201/api
NEXT_PUBLIC_PUBLIC_APP_URL=http://localhost:3010
NEXT_PUBLIC_APP_ENV=local
```

Backend must allow this origin:

```env
ADMIN_FRONTEND_URL=http://localhost:3012
```

External dashboards are configured as public URLs only. Credentials and API
tokens belong in the backend, GitHub Secrets, or AWS Secrets Manager, never in
`NEXT_PUBLIC_*` variables.

## Operations Center Contract

- `/infrastructure` reads backend, PostgreSQL, Redis, AI, PostHog, and tour
  worker signals. A failed worker request does not hide core service health.
- `/integrations` is a safe launch point for external consoles. It exposes URLs,
  never private credentials.
- `/deployments` documents the Local -> Staging -> Production promotion path and
  the required image, migration, health, smoke, and rollback controls.
- Host CPU, memory, disk, SSL expiry, container restart counts, CloudWatch
  alarms, and GitHub workflow runs require authenticated backend adapters before
  they can be rendered as live data.

Use `OpsPageHeader` for operations pages so titles, descriptions, freshness, and
page actions stay consistent. Extend `OpsSystemHealth` whenever the backend
health response gains a dependency; do not infer one service from another.

## Add A New Admin Area

1. Add the typed backend request to the owning module under `src/lib/api/`.
2. Create the route at `src/app/<area>/page.tsx` and wrap it with
   `GuardedOpsShell`.
3. Add exactly one entry to `src/lib/admin-navigation.ts`. The sidebar and
   command palette both update from that file.
4. Reuse `StateBlock`, `ConfirmDialog`, and the existing `ops-*` design tokens.
5. Verify ADMIN authorization in the backend guard; hiding a link is not a
   security boundary.
6. Run `npm run lint` and `npm run build` before opening a pull request.

## Daily Docker Workflow

Infra owns cross-repository local orchestration. From `~/Qivro/infra`:

```bash
./qivro up admin
./qivro logs admin
```

The development service bind-mounts `~/Qivro/admin` and keeps dependencies and
Next.js cache in named volumes, so normal source edits hot reload without a
rebuild. Rebuild only after changing dependencies, the Dockerfile, or build
configuration:

```bash
./qivro up --build admin
```

Use `./qivro restart admin` only when a process restart is required; source
changes normally do not need it.

Open `http://localhost:3012`. The command palette is available with
`Ctrl+K` or `Cmd+K`.
