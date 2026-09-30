# Development

Copy `.env.example` to `.env`, then install dependencies, start Compose infrastructure, migrate, and use `pnpm dev`. Turbo runs the web and API in parallel with hot reload. Ports are web `3000`, API `3001`, Postgres `5433`, Redis `6380`, MinIO API `9000`, and MinIO console `9001`.

Use `pnpm db:migrate` to apply existing migrations. During development create a migration with `pnpm --filter @eventflow/api exec prisma migrate dev --name <name>`; review the generated SQL before committing. Never edit an applied migration. Run `pnpm db:generate` after schema changes. EventFlow uses PostgreSQL `5433` and Redis `6380` locally when the default ports are already occupied by the preserved legacy platform.

For a local Event Workspace walkthrough, first ensure at least two users are already `ACTIVE`, then run `pnpm db:seed:demo`. The command is intentionally development-only, does not create authentication accounts, and refreshes deterministic events with dates relative to the execution time. It creates no storage objects or attachment metadata.

## Personal Event Calendar

The calendar consumes `GET /api/v1/calendar/items` for the currently visible Month, Week, or Day range. The range is sent as ISO-8601 `from`/`to`, where `from` is inclusive and `to` is exclusive; use the browser's selected calendar date rather than parsing a UTC date-only string with `new Date('YYYY-MM-DD')`. Category and source filters, plus search, are server-side filters and must retain the same visible range.

`pnpm db:seed:demo` also creates relative-date event and task examples across all supported calendar categories. It is idempotent and development-only. Calendar interaction is intentionally read-only in Sprint 4: create and update flows remain the Event Workspace flows, which invalidate the in-app calendar cache after a successful mutation. For acceptance evidence, use the [Sprint 4 calendar review checklist](sprint-4-review-checklist.md).

## Real-time configuration

Set `WS_ENABLED=true`, `WS_NAMESPACE=/notifications`, and `WS_ALLOWED_ORIGINS` to the same trusted browser origins as the frontend. `NEXT_PUBLIC_WS_URL` is the API origin and `NEXT_PUBLIC_WS_NAMESPACE` is `/notifications`. Engine.IO polling CORS is configured independently from REST CORS and requires credentials; do not use a wildcard origin. Redis adapter channels use `SOCKET_IO_REDIS_CHANNEL_PREFIX=eventflow:socket.io` and Redis must remain private.

The in-process outbox settings are `NOTIFICATION_OUTBOX_ENABLED`, `NOTIFICATION_OUTBOX_POLL_INTERVAL_MS`, `NOTIFICATION_OUTBOX_BATCH_SIZE`, `NOTIFICATION_OUTBOX_MAX_ATTEMPTS`, and `NOTIFICATION_OUTBOX_LOCK_TIMEOUT_MS`. They tune post-commit delivery only—do not turn a task assignment into a network-dependent transaction.

## Sprint 3 QA flow

With infrastructure running and migrations applied, create a disposable three-account fixture:

```powershell
$env:EVENTFLOW_QA_PASSWORD = 'a-local-development-password'
pnpm --filter @eventflow/api db:seed:sprint3-qa
# Copy the printed eventId before starting the verifier.
$env:EVENTFLOW_QA_EVENT_ID = '<eventId>'
# Start `pnpm dev` in another terminal, then run:
pnpm --filter @eventflow/api verify:sprint3-qa
```

The verifier signs in A (OWNER), B (delegated task manager), and C (normal member); it delegates `TASK_CREATE` and `TASK_ASSIGN`, creates an assigned task, waits for C's `notification.created`, verifies the persisted notification/action path, and marks it read. It is an API/socket smoke test, not a substitute for the browser-only toast, badge, and sound checks in the [Sprint 3 review checklist](sprint-3-review-checklist.md).

The normal quality sequence is `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`, and `pnpm build`. `pnpm check` runs lint, typecheck, unit/frontend tests, and build; it does **not** run e2e tests. API e2e requires reachable PostgreSQL, Redis, and the initialized MinIO bucket plus an `apps/api/.env.test` configuration (or equivalent process environment) that points to the intended isolated test stack. Run `pnpm test:e2e` separately, then use the [Sprint 3 review checklist](sprint-3-review-checklist.md) to record authorization, real-time, and responsive-layout evidence.
