# Sprint 2 completion report — Event Workspace and Task Management

## Delivered

EventFlow now has an event-scoped workspace on the existing pnpm / Next.js / NestJS / Prisma architecture. The implementation adds `Event`, `Department`, `WorkflowStage`, `EventMember`, `Task`, `TaskAssignee`, `TaskAttachment`, and `AuditLog`, with a new additive Prisma migration.

Event creation atomically creates the creator's ACTIVE OWNER membership and the four default stages. Event roles are held exclusively by `EventMember`; task assignments are held by `TaskAssignee.eventMemberId`. Event, membership, task, and attachment services enforce session authentication, CSRF for mutations, explicit backend permission checks, same-event validation, and archive rather than task deletion.

Task status transitions and personal-progress calculation are pure, tested backend rules. Attachments have MIME/signature and 10 MB validation, randomized private S3 keys, protected streaming download, and orphan cleanup when metadata persistence fails. Required audit actions are recorded transactionally.

The web application adds real API-backed My Events, event workspace, member management, role/permission, task create/edit/detail, and global My Tasks routes. The responsive shell uses a desktop-only sidebar and mobile-only header/bottom navigation; task detail retains a safe-area-aware mobile sticky status action.

`pnpm db:seed:demo` is development-only, uses existing ACTIVE users, and creates deterministic relative-date Vietnamese demo events, memberships, stages, and tasks without credentials or public storage objects.

## API and routes

Added `/api/v1/me/events`, event CRUD/archive/membership routes, event member routes, event task routes, global `/api/v1/me/tasks`, task detail/update/status/assignee/archive routes, and protected attachment upload/download/delete routes. Public frontend routes are documented in the Sprint 2 implementation and are all API-driven.

## Verification performed on 2026-09-30

- `pnpm check` — PASS: lint, strict typecheck, 23 API tests, 3 web tests, API build, and Next production build.
- `pnpm --filter @eventflow/api test:e2e -- workspace-auth.e2e-spec.ts` — PASS: 4/4 workspace authentication boundary tests.
- Static source scan — PASS: no EventHub branding, `blob:` URL, or `URL.createObjectURL` usage in `apps/web` or `apps/api`.
- Prisma schema is consumed by the strict API build and generated client typings used in typecheck.

For portable Windows builds, standalone Next output is enabled only by `NEXT_OUTPUT_STANDALONE=true`; the web Docker builder sets that value, while normal local `pnpm check` avoids a Windows symlink-permission-only failure.

## Known verification limits

`pnpm test:e2e` currently stops at the existing readiness test because PostgreSQL, Redis, and MinIO are not reachable locally (`/health/ready` returns 503). The remaining non-readiness e2e suites passed. The local database also has not received the Identity migration (`User.status` is absent), so migration deployment and `pnpm db:seed:demo` cannot be signed off until services are started. Docker image builds were not run for the same reason.

After the service stack is available, run:

```powershell
pnpm infra:up
pnpm db:migrate
pnpm db:seed:demo
pnpm test:e2e
docker build -f apps/api/Dockerfile -t eventflow-api:local .
docker build -f apps/web/Dockerfile -t eventflow-web:local .
```

At the time of this Sprint 2 report, the next recommended slice was event workflow administration followed by notification delivery. Sprint 3 has since delivered permission delegation and in-app real-time notifications; see the [Sprint 3 review checklist](sprint-3-review-checklist.md). The current backlog is maintained in [backlog.md](backlog.md).
