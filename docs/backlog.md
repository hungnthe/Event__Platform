# Delivery backlog

Completed foundation slices:

1. Identity: CSRF-protected password login, opaque server sessions, account state, and logout.
2. Event Workspace: event membership, workflow stages, assigned task management, task attachments, and personal progress.
3. Permission Delegation and Notifications: OWNER task-permission delegation, transactional durable notifications/outbox, authenticated Socket.IO delivery, notification center, multi-tab visual deduplication, and opt-in browser sound/desktop notifications while a client is connected.
4. Personal Event Calendar: membership- and assignment-scoped calendar read model, safe calendar detail endpoints, Month/Week/Day FullCalendar UI, responsive detail panel/sheet, category filtering, API-backed visible-range search, and route-safe sharing.

Next vertical slices:

1. Aggregate event documents, only if attachment access boundaries can be preserved.
2. Calendar write interactions, recurrence, and external calendar synchronization only after event/timezone rules and authorization boundaries are designed.
3. Budget management.
4. Web Push design and implementation for browser-closed notification delivery, including subscriptions, VAPID key rotation, and consent handling.
5. Public registration, ticketing, and attendee registration.
6. Production deployment and hardening.

See the [Sprint 2 review checklist](sprint-2-review-checklist.md), [Sprint 3 review checklist](sprint-3-review-checklist.md), and [Sprint 4 calendar review checklist](sprint-4-review-checklist.md) for release acceptance gates.
