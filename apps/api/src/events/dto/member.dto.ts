import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsEmail, IsEnum, IsIn, IsInt, IsString, IsUUID, MaxLength, Min, ValidateIf } from 'class-validator';
import { EventMemberRole } from '@prisma/client';

export class CreateEventMemberDto {
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsUUID()
  userId?: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @IsEnum(EventMemberRole)
  role!: EventMemberRole;

  @ValidateIf((_object, value: unknown) => value !== undefined && value !== null)
  @IsUUID()
  departmentId?: string | null;
}

export class UpdateEventMemberDto {
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsEnum(EventMemberRole)
  role?: EventMemberRole;

  @ValidateIf((_object, value: unknown) => value !== undefined && value !== null)
  @IsUUID()
  departmentId?: string | null;
}

export class RemoveEventMemberDto {
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  replacementAssigneeIds?: string[];
}

export class EventMembersQueryDto {
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @MaxLength(120)
  search?: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsEnum(EventMemberRole)
  role?: EventMemberRole;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsUUID()
  departmentId?: string;

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
  @IsIn(['joinedAt:desc', 'displayName:asc'])
  sort?: 'joinedAt:desc' | 'displayName:asc';
}
