# Sprint 2 — final review checklist

Review date: 2026-09-30. A checked item has been verified by source review and the relevant automated checks where those can run without the local service stack.

## Requested acceptance checklist

- [x] Không dùng `blob:` URL — web source has no `blob:`, `createObjectURL`, or public object-key response. Event cover fallback is a local SVG.
- [x] Branding là **EventFlow**, không phải EventHub — application metadata, login, shell, and event screens use EventFlow; no EventHub reference remains in `apps/web` or `apps/api`.
- [x] Trang không dùng permanent mock data — event, member, task, and attachment entities are decoded from API responses; static labels and the local placeholder SVG are presentation-only.
- [x] My Events lấy dữ liệu thật — `GET /api/v1/me/events` drives search, filters, status counts, cards, and personal progress.
- [x] Event chỉ hiện với thành viên — `EventAccessService.requireMembership` requires an ACTIVE `EventMember`; removed members lose access.
- [x] Role nằm trên EventMember, không nằm trên User — `User.systemRole` remains platform-level and `EventMember.role` is used for event authorization.
- [x] Task assign EventMember, không assign User trực tiếp — `TaskAssignee.eventMemberId` is the assignment boundary and validates ACTIVE membership in the same event.
- [x] Backend kiểm tra permission — guarded controllers and backend permission checks protect event, member, task, and attachment operations; CSRF protects mutations.
- [x] Member chỉ thấy task được phép — members/volunteers are restricted to assigned tasks; department leads are restricted to their department; owners/coordinators can view event-wide tasks.
- [x] Status transition được validate ở backend — `task-rules.ts` enforces actor-specific transitions and returns `TASK_STATUS_TRANSITION_INVALID` on rejection.
- [x] Personal progress tính đúng — only active, non-cancelled tasks assigned to the current `EventMember` contribute; multi-assignee work counts once per assignee.
- [x] Mobile không có desktop sidebar — sidebar is `hidden ... lg:flex`.
- [x] Desktop không có mobile bottom bar — mobile navigation is `lg:hidden`.
- [x] Task detail có sticky action trên mobile — mobile-only sticky status action reserves safe-area-aware content space.
- [x] File không public trực tiếp — uploads have randomized private object keys; download streams through a protected API endpoint and contracts omit the object key.
- [x] Không hard-delete task — there is no task DELETE route; archive writes `Task.archivedAt` and audit history.
- [x] Không có cross-event access — workflow stage, department, assignee, member, task, and attachment lookups are scoped to the task/event and rejected when mismatched.
- [x] `pnpm check` pass — lint, strict typecheck, unit/frontend tests, and production builds completed successfully.

## Automated evidence

| Command | Result |
| --- | --- |
| `pnpm check` | PASS — lint, typecheck, 23 API tests, 3 web tests, and API/web production builds. |
| `pnpm --filter @eventflow/api test:e2e -- workspace-auth.e2e-spec.ts` | PASS — 4/4 unauthenticated workspace-boundary tests. |
| `rg -n -i "eventhub|blob:|createObjectURL" apps/web apps/api` | PASS — no matches. |
| `pnpm test:e2e` | Not signed off locally: readiness test returns 503 because PostgreSQL, Redis, and MinIO are unavailable. The non-readiness suites passed. |
| Migration, demo seed, Docker image builds | Pending local service availability. The database currently lacks the earlier Identity migration (`User.status`), so migration must be deployed before the development seed can run. |

## Review boundary

The unchecked infrastructure verification is not bypassed by the passing application check. Once Docker Desktop and the required services are available, run `pnpm infra:up`, `pnpm db:migrate`, `pnpm db:seed:demo`, `pnpm test:e2e`, and both Docker builds before production release.
