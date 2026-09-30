# Architecture

EventFlow is a pnpm/Turborepo modular monolith. `apps/web` is a Next.js App Router UI. Its server-side `/api/system-status` proxy obtains the configured API base URL at runtime and the client presents loading, success, and failure states. `apps/api` is a NestJS REST API under `/api/v1`; Swagger is outside the API prefix at `/docs`.

The readiness service fans out concurrently to Prisma/PostgreSQL, Redis, and the configured S3-compatible bucket. Liveness has no external dependencies. Shared public DTOs—including notification socket payloads—live in `packages/contracts`; Prisma remains private to the API.

Security defaults include config validation, validation pipes, Helmet, exact credentials-aware CORS, 100 KB body limits, request IDs, JSON structured logs, error envelopes, and graceful shutdown. Secrets remain only in environment configuration.

The authentication module uses email/password login with Argon2id verification. It creates opaque random session tokens, sends their raw value only in the `eventflow_session` HTTP-only cookie, and stores only SHA-256 token hashes in PostgreSQL. Sessions are checked against expiry, revocation, and ACTIVE account status on every identity request and Socket.IO handshake. Unsafe auth requests require the signed double-submit CSRF token from `GET /api/v1/auth/csrf`; its secret is required in production. Redis limits login attempts per IP, and five invalid password attempts within fifteen minutes lock an account for fifteen minutes.

## Event permissions

`SystemRole` stays platform-scoped (`USER` or `SYSTEM_ADMIN`). It does not grant access to an event. Event access always begins with an ACTIVE `EventMember`, whose `EventMemberRole` supplies base permissions. An OWNER can additionally grant a member one of the explicit task permissions: `TASK_VIEW_ALL`, `TASK_CREATE`, `TASK_UPDATE_ANY`, `TASK_ASSIGN`, `TASK_UPDATE_STATUS_ANY`, or `TASK_ARCHIVE`.

Effective permissions are calculated from current database state on each protected request:

```text
role-derived EventPermission set
  UNION active, same-event, non-revoked, non-expired delegated grants
```

Expiry and revocation therefore take effect without a new login. Only an ACTIVE OWNER can change delegated task permissions. A grant is event-scoped, and its reusable unique row prevents duplicate active grants.

## Personal Event Calendar

The calendar is a read-only projection, not a parallel event or task store. `GET /api/v1/calendar/items` accepts an ISO-8601 half-open visible range (`from` inclusive, `to` exclusive), optional source/category filters, and a bounded search term. The API rejects inverted or over-93-day ranges and returns at most 300 compact, safe items.

Event items are selected only when the current user is ACTIVE and has an ACTIVE `EventMember` row; archived events are excluded. Task items apply the same live view policy as task detail: active assignment, global owner/coordinator or `TASK_VIEW_ALL` access, a matching department-lead scope, or a task created through a current `TASK_CREATE` permission. Search is an additional `AND` condition, never an authorization alternative. The detail endpoint reuses `EventAccessService.requireTaskView`, so a direct URL cannot bypass an event membership, assignee boundary, or delegated view permission. Responses expose display metadata and internal IDs only; attachment keys, signed URLs, session data, and storage credentials are never calendar fields.

`CalendarCategory` is semantic metadata stored on `Event` and `Task` (`EVENT`, `TASK`, `MEETING_INTERNAL`, `VOLUNTEER`, `OTHER`). It is not a permission mechanism. The web app uses FullCalendar's Month, Week, and Day views as a client-side rendering primitive while every range/search result remains API data. Its query state is reflected in the URL without a full document reload. Internal share links contain only the event route, never a token.

## Durable notifications and real-time delivery

Task creation and assignee replacement calculate newly added assignment episodes inside the business transaction. For every eligible new recipient other than the actor, the transaction writes a recipient-owned `Notification` and a matching `OutboxEvent`; unique assignment-episode keys make repeated requests idempotent. A failed WebSocket delivery never rolls back a task assignment or deletes its notification.

The in-process outbox dispatcher claims small batches with a status/lease compare-and-set, emits `NOTIFICATION_CREATED`, and marks the row `PUBLISHED` after the event is accepted for local Socket.IO emission. Transient dispatcher errors are retried with bounded exponential backoff; permanent failures retain sanitized diagnostic text. Socket.IO delivery is application-level at-least-once: a stale lease or network retry can repeat an event, and clients deduplicate by stable notification ID. REST reconciliation of unread notifications remains the recovery path when a client reconnects or a real-time attempt is unavailable.

The Socket.IO namespace is `/notifications`. The server authenticates the existing HTTP-only session cookie, checks the configured Origin, then alone joins `user:{userId}` and `session:{sessionId}` rooms. Client payloads cannot select a user or room. The Redis adapter uses separate private publish/subscribe connections and the `eventflow:socket.io` channel prefix for multi-instance fanout. Logout or all-session revocation emits `session.revoked` and disconnects matching session/user rooms; active sockets are also scheduled to close at session expiry.

The browser receives versioned `notifications.ready`, `notification.created`, `notification.read`, `notifications.read-all`, `notifications.unread-count`, and `session.revoked` payloads. Payloads contain a safe internal action path and recipient-safe notification projection only—never session data, attachment keys, full task descriptions, or storage credentials.

Browser sound is best effort after an explicit user gesture because browser audio policy is authoritative. Desktop notifications are opt-in and browser permission is authoritative. Notifications work while an authenticated EventFlow client is open or backgrounded and connected; browser-closed delivery would require Web Push, VAPID, subscriptions, and a push service, which are deliberately out of scope.
