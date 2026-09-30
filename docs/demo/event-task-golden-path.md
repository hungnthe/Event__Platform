# EventFlow event–task golden path demo

## Prerequisites

- Node.js 22+, pnpm 11+, Docker Desktop.
- PostgreSQL, Redis and MinIO from `infra/compose.dev.yml` are healthy.
- Copy `.env.example` to `.env` and replace local-only secrets.

## Environment variables

```dotenv
DEMO_OWNER_EMAIL=owner@eventflow.demo
DEMO_MEMBER_EMAIL=member@eventflow.demo
DEMO_USER_PASSWORD=<local password, at least 12 characters>
```

Never commit the real password. Both accounts are prepared as ACTIVE platform
`USER` accounts; event authorization is still derived only from EventMember.

## Start and prepare

```bash
pnpm infra:up
pnpm db:migrate
pnpm demo:prepare:event-task-flow
pnpm dev
```

The prepare command removes only an earlier event named exactly
`DEMO - Workshop Kỹ năng AI 2026` when it was created by `DEMO_OWNER_EMAIL`.
It does not create the event; the presenter creates it through the UI.

## Two-browser setup

Open a normal window for the owner and a private/different-browser window for
the member. Log in at `http://localhost:3000/login` using the emails above and
the password stored in `DEMO_USER_PASSWORD`.

## Exact demo data

Create the event as the owner:

- Name: `DEMO - Workshop Kỹ năng AI 2026`
- Description: `Workshop thực hành AI dành cho đội ngũ tổ chức sự kiện.`
- Location: `EventFlow Demo Hall`
- Start: any future local date at least seven days away
- End: two hours after start

On Members, add `DEMO_MEMBER_EMAIL` as `MEMBER` in `Logistics`.

In `PREPARATION`, create two TEAM tasks with deadlines before event start:

1. `Liên hệ nhà cung cấp âm thanh` — HIGH — assignee: Demo Member — Logistics.
2. `Chuẩn bị danh sách khách mời` — MEDIUM — assignee: Demo Owner.

## Expected progress and notifications

- Initially: event and PREPARATION are `0/2 — 0%`.
- Member completes Task 1: event and PREPARATION are `1/2 — 50%`; member
  personal progress is `1/1 — 100%`.
- Owner completes Task 2: event and PREPARATION are `2/2 — 100%`.
- Member receives exactly one durable `TASK_ASSIGNED` notification for Task 1,
  plus `notification.created` in real time. Self-assignment does not notify the
  owner.
- Each committed status change emits `event.progress.updated`; the other
  browser updates without a manual reload.

## Presenter script

1. Owner creates the event and confirms role `Chủ sự kiện`, five default
   departments and the four canonical workflow stages.
2. Owner adds the member, then creates both tasks in PREPARATION.
3. Show `0/2 — 0%` in the owner window.
4. In the member window, open the notification and click `Bắt đầu công việc`,
   then `Đánh dấu hoàn thành`.
5. Show `1/1 — 100%` personal progress for the member and `1/2 — 50%` updating
   in the owner window without refresh.
6. Owner completes Task 2 and shows `2/2 — 100%`.

## Troubleshooting

- Check `GET http://localhost:3001/api/v1/health/ready`.
- Confirm ports 3000, 3001, 5433, 6380 and 9000 are available.
- Confirm both users are ACTIVE and that the member was added to this event.
- A `403` means the live EventMember permission check rejected the action; do
  not work around it with a platform admin role.
- If the socket is temporarily unavailable, continue the demo using the
  durable notification center and reopen the event. Reconnection always
  retrieves authoritative progress from `GET /api/v1/events/:eventId/progress`.

## Reset

```bash
pnpm demo:reset:event-task-flow
```

Reset removes only the exact owner-created demo event and its dependent demo
records. It preserves the demo users and all unrelated data.
