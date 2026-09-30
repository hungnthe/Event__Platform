import { Type } from 'class-transformer';
import { ArrayUnique, IsArray, IsDateString, IsEnum, ValidateIf } from 'class-validator';
import { EventDelegatedPermission } from '@prisma/client';

/** Full desired state for this member's explicitly delegated task permissions. */
export class UpdateDelegatedPermissionsDto {
  @IsArray()
  @ArrayUnique()
  @IsEnum(EventDelegatedPermission, { each: true })
  permissions!: EventDelegatedPermission[];

  @ValidateIf((_object, value: unknown) => value !== undefined && value !== null)
  @Type(() => String)
  @IsDateString()
  expiresAt!: string | null;
}
