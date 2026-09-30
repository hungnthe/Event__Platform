CREATE TYPE "CalendarCategory" AS ENUM ('EVENT', 'TASK', 'MEETING_INTERNAL', 'VOLUNTEER', 'OTHER');

ALTER TABLE "Event"
  ADD COLUMN "calendarCategory" "CalendarCategory" NOT NULL DEFAULT 'EVENT';

ALTER TABLE "Task"
  ADD COLUMN "calendarCategory" "CalendarCategory" NOT NULL DEFAULT 'TASK';
