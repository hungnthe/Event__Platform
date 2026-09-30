# Sprint 4 — Personal Event Calendar review

Review date: 2026-09-30. Checked items have source and automated evidence. The two browser-only responsive/interactions checks remain for a final local browser pass; they are not inferred from component tests.

## Product and authorization review

- [x] Branding is **EventFlow** throughout the calendar UI; no EventHub copy was added.
- [x] Calendar event covers use no `blob:` URL. The calendar API currently returns no cover URL because the existing event model has no safe cover-delivery surface.
- [x] The client has no hard-coded calendar item list; visible items and search results use `GET /api/v1/calendar/items`.
- [x] Event items require an ACTIVE current-user `EventMember`; archived events are excluded.
- [x] Task list items apply the existing backend task-view policy: active assignment, global/delegated view, matching department scope, or an eligible task creator. Search is combined with that scope using `AND`; task detail reuses the same policy.
- [x] Month, Week, and Day use client-side FullCalendar transitions; the URL is updated with `router.replace` rather than a document reload.
- [x] Previous, Next, and Today are wired to the active FullCalendar view.
- [x] Debounced search repeats the exact current visible range and calls the backend with search/filter parameters.
- [x] Clicking an event opens its detail panel; clicking a task opens task detail in the same panel/sheet.
- [x] Event detail navigates to `/app/events/{eventId}`; related work navigates to `/app/events/{eventId}?tab=tasks` and activates the tasks tab.
- [x] Share uses only an internal event route and never appends a session, API, or signed-download token.
- [x] Desktop renders a persistent right detail panel; the small viewport uses a bottom sheet above the mobile navigation.
- [x] Calendar styles keep the grid constrained at narrow widths and compact cells at `max-width: 639px`; final 320px browser verification remains below.
- [x] The existing authenticated notification bell remains in the shared application shell and invalidates calendar data after relevant task notifications.
- [x] Direct calendar detail/list requests are session-protected and backend-scoped; UI hiding is not the authorization control.
- [x] Local calendar date parsing/formatting avoids `new Date('YYYY-MM-DD')`, preserving selected dates across UTC offsets.

## Automated evidence

| Command or check | Result |
| --- | --- |
| Prisma migration `20261003000000_add_calendar_categories` | PASS against local PostgreSQL. |
| `pnpm db:seed:demo` | PASS — seeded four idempotent relative-date EventFlow events with category coverage. |
| API calendar service tests | PASS — membership/assignment query scope, overlap/due range, invalid-range rejection, and protected task detail. |
| Web calendar helper/component tests | PASS — local date, navigation, category helpers, URL state, and client navigation. |
| `pnpm --filter @eventflow/api lint` | PASS. |
| `pnpm --filter @eventflow/api typecheck` | PASS. |
| `pnpm --filter @eventflow/web lint` | PASS. |
| `pnpm --filter @eventflow/web typecheck` | PASS. |
| `pnpm check` | PASS — repository lint, typecheck, 39 API tests, 15 web tests, and optimized API/Next.js production builds. |
| `pnpm --filter @eventflow/api test:e2e -- test/workspace-auth.e2e-spec.ts` | PASS — 9 unauthenticated-route guards, including calendar list and detail. |
| Full API e2e suite | PASS — 3 suites / 12 tests against the migrated local PostgreSQL, Redis, and MinIO configuration supplied to the test process. The bare command still requires an `apps/api/.env.test` file (or equivalent environment) and intentionally does not silently fall back to development settings. |
| `docker build -f apps/api/Dockerfile -t eventflow-api:sprint4-local .` | PASS — API production image compiled contracts, generated Prisma Client, and built NestJS output. |
| `docker build -f apps/web/Dockerfile -t eventflow-web:sprint4-local .` | PASS — web production image built the standalone Next.js output, including `/app/calendar`. |

## Final manual browser pass

- [ ] At 320px width, open Month, Week, and Day and verify the page has no horizontal overflow; verify dense cells remain usable.
- [ ] On desktop, click an event and a task to confirm the right panel; on mobile, confirm the bottom sheet opens, closes with the close button/Escape, and remains above the bottom navigation.
- [ ] While an authenticated calendar is open, create or reassign a task in another EventFlow view; confirm the existing notification bell still shows its real-time update and the calendar refreshes safely.

## Release boundary

Sprint 4 intentionally does not add calendar writes, drag/drop, recurring items, public event feeds, external calendar synchronization, or file delivery. Task/event mutation remains in the event workspace so existing membership, delegation, status-transition, and attachment boundaries stay authoritative.
