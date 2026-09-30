# EventFlow Foundation

EventFlow is a production-oriented modular monolith. It includes CSRF-protected email/password login, server-managed opaque sessions, membership-scoped events and tasks, explicit event-level task-permission delegation, durable in-app task notifications delivered through Socket.IO when an authenticated client is connected, and a personal Event Calendar backed by the same authorization rules. Organization billing, ticketing, attendee registration, budget management, discussions, third-party calendar synchronization, recurring work, native mobile apps, and browser-closed push notifications remain out of scope.

## Prerequisites

Node.js 22+, pnpm 11+, Docker Desktop with Docker Compose v2.

## Clean start

```powershell
Copy-Item .env.example .env
pnpm install
pnpm infra:up
pnpm db:migrate
pnpm dev
```

Frontend: `http://localhost:3000`; login: `http://localhost:3000/login`; system status: `http://localhost:3000/system-status`; API Swagger: `http://localhost:3001/docs`; MinIO console: `http://localhost:9001`. When coexisting with the preserved legacy platform, EventFlow maps PostgreSQL to `5433` and Redis to `6380`.

Authentication uses the `eventflow_session` HTTP-only cookie and stores only its SHA-256 hash in PostgreSQL. The browser first obtains `GET /api/v1/auth/csrf`, then sends its returned token in `X-CSRF-Token` for login and logout. Configure a unique `CSRF_SECRET` before production deployment; the development fallback is intentionally not suitable for production.

## Commands

`pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`, `pnpm build`, and `pnpm check` validate the repository. `pnpm infra:up|down|logs` controls development dependencies. `pnpm db:generate`, `pnpm db:migrate`, and `pnpm db:reset` manage Prisma.

`pnpm db:seed:demo` creates or refreshes deterministic EventFlow demo events, memberships, workflow stages, and tasks. It runs only when `NODE_ENV=development`, uses existing ACTIVE users (one owner and at least one member), and refuses to create accounts if fewer than two qualifying users exist. It deliberately does not create storage objects or attachment rows, so demo downloads can never point to nonexistent files.

## Sprint 3 local notification QA

For the complete A/B/C permission-delegation and real-time notification check, use a development-only fixture. Choose a throwaway password locally; it is never committed.

```powershell
$env:EVENTFLOW_QA_PASSWORD = 'a-local-development-password'
pnpm --filter @eventflow/api db:seed:sprint3-qa
# Copy eventId from the JSON printed by the previous command.
$env:EVENTFLOW_QA_EVENT_ID = '<eventId>'
pnpm dev
# In a second terminal, after API and web are ready:
pnpm --filter @eventflow/api verify:sprint3-qa
```

The verifier validates the server-side A → B → C API and Socket.IO route. Follow the browser checklist in [Sprint 3 review](docs/sprint-3-review-checklist.md) to verify the bell, toast, audio policy, and navigation behavior visually.

Build production images from the repository root:

```powershell
docker build -f apps/api/Dockerfile -t eventflow-api:local .
docker build -f apps/web/Dockerfile -t eventflow-web:local .
```

See [development](docs/development.md), [architecture](docs/architecture.md), [deployment](docs/deployment.md), [backlog](docs/backlog.md), the [Sprint 3 review checklist](docs/sprint-3-review-checklist.md), and the [Sprint 4 calendar review checklist](docs/sprint-4-review-checklist.md) for operational detail.

## Troubleshooting

If a readiness dependency is down, run `pnpm infra:logs`, confirm the ports below are free, and refresh `/system-status`. Run `pnpm db:generate` after changing Prisma schema, and use a new migration for every schema change. Never put real secrets in `.env.example`. See the [Sprint 3 review checklist](docs/sprint-3-review-checklist.md) and [Sprint 4 calendar review checklist](docs/sprint-4-review-checklist.md) for release evidence.
