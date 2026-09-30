import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsDateString, IsEnum, IsIn, IsString, MaxLength, ValidateIf } from 'class-validator';
import { CalendarCategory } from '@prisma/client';

function queryList(value: unknown): unknown {
  if (Array.isArray(value)) return value.flatMap((entry) => typeof entry === 'string' ? entry.split(',') : [entry]).filter(Boolean);
  if (typeof value === 'string') return value.split(',').filter(Boolean);
  return value;
}

export class CalendarItemsQueryDto {
  @IsDateString()
  from!: string;

  @IsDateString()
  to!: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(({ value }: { value: unknown }) => queryList(value))
  @IsArray()
  @ArrayMaxSize(5)
  @IsEnum(CalendarCategory, { each: true })
  categories?: CalendarCategory[];

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(({ value }: { value: unknown }) => queryList(value))
  @IsArray()
  @ArrayMaxSize(2)
  @IsIn(['EVENT', 'TASK'], { each: true })
  sourceTypes?: Array<'EVENT' | 'TASK'>;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @MaxLength(120)
  search?: string;
}
