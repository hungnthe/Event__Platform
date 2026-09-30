import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsIn, IsInt, IsString, MaxLength, Min, ValidateIf } from 'class-validator';
import { CalendarCategory, EventStatus } from '@prisma/client';

export class CreateEventDto {
  @IsString()
  @MaxLength(200)
  name!: string;

  @ValidateIf((_object, value: unknown) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(10_000)
  description?: string | null;

  @ValidateIf((_object, value: unknown) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(300)
  locationName?: string | null;

  @IsDateString()
  startsAt!: string;

  @IsDateString()
  endsAt!: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsEnum(EventStatus)
  status?: EventStatus;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsIn([CalendarCategory.EVENT, CalendarCategory.VOLUNTEER, CalendarCategory.OTHER])
  calendarCategory?: CalendarCategory;
}

export class UpdateEventDto {
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @MaxLength(200)
  name?: string;

  @ValidateIf((_object, value: unknown) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(10_000)
  description?: string | null;

  @ValidateIf((_object, value: unknown) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(300)
  locationName?: string | null;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsDateString()
  startsAt?: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsDateString()
  endsAt?: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsEnum(EventStatus)
  status?: EventStatus;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsIn([CalendarCategory.EVENT, CalendarCategory.VOLUNTEER, CalendarCategory.OTHER])
  calendarCategory?: CalendarCategory;
}

export class MyEventsQueryDto {
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsEnum(EventStatus)
  status?: EventStatus;

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
  @IsIn(['startsAt:asc', 'startsAt:desc', 'createdAt:desc'])
  sort?: 'startsAt:asc' | 'startsAt:desc' | 'createdAt:desc';
}
