# Sprint 3 — Permission Delegation and Real-Time Notifications review

Review date: 2026-09-30. A checked implementation item has source and automated evidence. A manual-browser item remains unchecked until it is performed against a migrated PostgreSQL/Redis/MinIO environment; do not infer UI/audio behavior from API tests.

## Implementation review

- [x] Event-level delegation remains separate from `SystemRole`; an ACTIVE `EventMember` is always required for event access.
- [x] OWNER-only delegated task permissions are stored as event/member-scoped grants; revoked and expired grants are excluded from every live effective-permission calculation.
- [x] `TASK_CREATE` and `TASK_ASSIGN` allow B to create and assign only after A grants them; frontend visibility is never authorization.
- [x] Task assignment validates the assignee's ACTIVE membership and ACTIVE platform account in the same event.
- [x] New task-assignment episodes create recipient-owned durable `Notification` and matching `OutboxEvent` records in the same PostgreSQL transaction as the task mutation.
- [x] Existing unchanged assignees do not create another assignment episode or notification; the actor is not notified when assigning themself.
- [x] Notification action paths are backend-generated internal `/app/...` paths; external, protocol-relative, `javascript:`, `data:`, and malformed action paths are rejected.
- [x] Notifications list, unread count, read, read-all, and preferences endpoints are authenticated and CSRF protects mutations.
- [x] Notification read operations are recipient-scoped and idempotent; read events synchronize open tabs through the authenticated user room.
- [x] Outbox dispatch uses a claim lease, bounded exponential retry, sanitized errors, and durable notification recovery. A `PUBLISHED` outbox row means the event was accepted for local Socket.IO emission, not literal exactly-once network delivery.
- [x] Socket.IO `/notifications` authenticates the existing HTTP-only session cookie, validates Origin, and only the server chooses `user:{userId}` and `session:{sessionId}` rooms.
- [x] Engine.IO polling CORS is configured with trusted `WS_ALLOWED_ORIGINS` and credentials; REST CORS alone is not relied on.
- [x] Redis Socket.IO adapter has separate publish/subscribe connections, a private configurable channel prefix, and local fallback logging if it is unavailable.
- [x] Session logout/revoke disconnects matching session/user rooms; active sockets are also scheduled to close at session expiry.
- [x] Client reconciliation fetches unread count and recent unread notifications after connect/reconnect. Notification IDs deduplicate repeated socket delivery, toasts, list entries, and multi-tab sound claims.
- [x] Sound is preference-controlled and only attempted after browser audio unlock. Desktop notification permission is requested only after explicit user action.
- [x] Browser-closed push delivery is explicitly out of scope for this sprint.

## Automated evidence

| Command or check | Result |
| --- | --- |
| `pnpm --filter @eventflow/api typecheck` | PASS during Sprint 3 integration. |
| `pnpm --filter @eventflow/api lint` | PASS during Sprint 3 integration. |
| `pnpm --filter @eventflow/api build` | PASS during Sprint 3 integration. |
| `pnpm --filter @eventflow/api test -- notifications` | PASS — 2 suites, 9 focused action-path/content tests. |
| `pnpm --filter @eventflow/api run test:e2e -- test/workspace-auth.e2e-spec.ts` | PASS — 7 protected-route assertions, including notification endpoints. |
| Temporary runtime boot | PASS — API started through `ts-node`; `/api/v1/health/live` returned `ok`. |
| Engine.IO preflight | PASS — `OPTIONS /socket.io/?EIO=4&transport=polling` from `http://localhost:3000` returned `204`, allowed that origin, and enabled credentials. |
| `pnpm check` | PASS on 2026-09-30 — workspace lint, typecheck, 45 unit/frontend tests, and production build completed with exit code 0. |
| `pnpm --filter @eventflow/api verify:sprint3-qa` | PASS on 2026-09-30 against migrated local PostgreSQL/Redis/MinIO and the real Socket.IO server. |
| Manual A/B/C browser path | Completed below on the same local stack. Speaker output remains explicitly unverified. |

## Local A/B/C fixture and server verification

The QA seed is intentionally local-development-only. It creates exactly three disposable accounts and prints an event ID:

```powershell
$env:EVENTFLOW_QA_PASSWORD = 'a-local-development-password'
pnpm infra:up
pnpm db:migrate
pnpm --filter @eventflow/api db:seed:sprint3-qa
# Copy the printed eventId.
$env:EVENTFLOW_QA_EVENT_ID = '<eventId>'
pnpm dev
# In another terminal:
pnpm --filter @eventflow/api verify:sprint3-qa
```

Accounts created only by this local QA command:

| Test identity | Email | Initial event role |
| --- | --- | --- |
| User A | `qa.owner@eventflow.local` | OWNER |
| User B | `qa.assigner@eventflow.local` | MEMBER, no delegated task permissions |
| User C | `qa.member@eventflow.local` | MEMBER |

`verify:sprint3-qa` uses real HTTP cookies, CSRF, permissions, PostgreSQL, and Socket.IO. It makes A delegate `TASK_CREATE` and `TASK_ASSIGN` to B, then verifies B creates a task for C, C receives one `notification.created`, the persisted notification points to the exact task path, C can read that task, and marking the notification read restores the unread count. It does not make claims about browser toast/audio rendering.

## Critical manual browser flow — A/B/C

Run this against the same local fixture after `pnpm dev` is ready. Use separate browser profiles/incognito contexts for A, B, and C so cookies cannot be shared. For C, click once inside EventFlow first if the browser requires a user gesture to unlock sound.

Manual run completed on 2026-09-30 via `127.0.0.1` after the local Chrome environment blocked `localhost`. Browser automation shares a cookie jar across named Chrome tabs, so C was re-authenticated before the persisted read-state step. That limitation did not affect the already-observed live socket notification.

- [x] **A login**: Signed in as User A with `qa.owner@eventflow.local`.
- [x] **A delegates**: Opened B in members, selected **Giao quyền quản lý công việc**, enabled `TASK_CREATE` and `TASK_ASSIGN`, and saved. The UI confirmed “Đã cập nhật quyền quản lý công việc.”
- [x] **B login**: Signed in as `qa.assigner@eventflow.local`; **Tạo công việc** became available only after A's grant.
- [x] **B creates and assigns**: Created task `5f549222-10f1-47e9-b725-43a562dd0d84` and assigned it to User C.
- [x] **C stays online**: C's EventFlow context was open before B saved and received the live socket event.
- [x] **One visual notification**: From a baseline of zero unread notifications, C received one toast, badge `1`, and one matching unread notification-center item for the task above.
- [ ] **One sound when enabled**: **Unverified in browser automation** — automation cannot observe speaker output. The source has a focused test that emits the same socket notification twice and asserts one chime invocation; it passed as part of `pnpm check`.
- [x] **Exact navigation**: Clicking **Xem công việc** opened exactly `/app/events/4188d66c-d17e-4f22-b95b-afdf27063014/tasks/5f549222-10f1-47e9-b725-43a562dd0d84`.
- [x] **Read state**: After opening it, C's bell had no unread badge and the center displayed **Đã đọc hết**.
- [ ] **Cross-tab read synchronization**: Not manually asserted because the browser-automation tabs share one cookie jar. The authenticated user-room behavior is covered by the implementation and API/socket verification.
- [ ] **Reconnect recovery**: Disconnect/close C's socket, have B assign a second task, then reconnect C. Confirm the persisted unread notification appears after reconciliation without creating a second database notification.
- [ ] **Authorization regression**: Revoke B's `TASK_ASSIGN`, refresh/retry B's assignment action, and confirm the backend rejects it. B must not retain permission due to a stale session.

## Release boundary

This slice provides in-app real-time delivery while a client is connected or backgrounded. It does not provide operating-system notification delivery after the browser is fully closed. The `pnpm check`, migration/seed, API/socket QA, and critical A/B/C browser path above have completed. Do not sign off the remaining audio, cross-tab, reconnect, authorization-regression, full `pnpm test:e2e`, or Docker image checks until they have actually completed.
