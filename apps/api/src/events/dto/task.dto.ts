import { Transform, Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsDateString, IsEnum, IsIn, IsInt, IsString, IsUUID, MaxLength, Min, ValidateIf } from 'class-validator';
import { CalendarCategory, TaskOrigin, TaskPriority, TaskStatus } from '@prisma/client';

export class CreateTaskDto {
  @IsString()
  @MaxLength(300)
  title!: string;

  @ValidateIf((_object, value: unknown) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(20_000)
  description?: string | null;

  @IsUUID()
  workflowStageId!: string;

  @ValidateIf((_object, value: unknown) => value !== undefined && value !== null)
  @IsUUID()
  departmentId?: string | null;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsIn([CalendarCategory.TASK, CalendarCategory.MEETING_INTERNAL, CalendarCategory.VOLUNTEER, CalendarCategory.OTHER])
  calendarCategory?: CalendarCategory;

  @IsDateString()
  dueAt!: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  assigneeEventMemberIds?: string[];

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsIn(['PERSONAL', 'TEAM'])
  creationMode?: 'PERSONAL' | 'TEAM';
}

export class UpdateTaskDto {
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @MaxLength(300)
  title?: string;

  @ValidateIf((_object, value: unknown) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(20_000)
  description?: string | null;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsUUID()
  workflowStageId?: string;

  @ValidateIf((_object, value: unknown) => value !== undefined && value !== null)
  @IsUUID()
  departmentId?: string | null;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsIn([CalendarCategory.TASK, CalendarCategory.MEETING_INTERNAL, CalendarCategory.VOLUNTEER, CalendarCategory.OTHER])
  calendarCategory?: CalendarCategory;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsDateString()
  dueAt?: string;
}

export class UpdateTaskStatusDto {
  @IsEnum(TaskStatus)
  status!: TaskStatus;
}

export class ReplaceTaskAssigneesDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  eventMemberIds!: string[];
}

export class EventTasksQueryDto {
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsIn(['mine', 'all'])
  scope?: 'mine' | 'all';

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsUUID()
  workflowStageId?: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsUUID()
  departmentId?: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(({ value }: { value: unknown }) => value === true || value === 'true')
  @IsBoolean()
  overdue?: boolean;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @MaxLength(120)
  search?: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsIn(['dueAt:asc', 'dueAt:desc', 'createdAt:desc', 'priority:desc'])
  sort?: 'dueAt:asc' | 'dueAt:desc' | 'createdAt:desc' | 'priority:desc';
}

export class MyTasksQueryDto extends EventTasksQueryDto {
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsUUID()
  eventId?: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(({ value }: { value: unknown }) => value === true || value === 'true')
  @IsBoolean()
  dueSoon?: boolean;
}

export class WorkflowStageTasksQueryDto extends EventTasksQueryDto {
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsEnum(TaskOrigin)
  origin?: TaskOrigin;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsUUID()
  assigneeEventMemberId?: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(({ value }: { value: unknown }) => value === true || value === 'true')
  @IsBoolean()
  mineOnly?: boolean;
}
