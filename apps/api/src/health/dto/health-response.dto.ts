import { ApiProperty } from '@nestjs/swagger';
import type { HealthDependencies, ReadinessFailureResponse, ReadinessResponse } from '@eventflow/contracts';

export class HealthDependenciesDto implements HealthDependencies {
  @ApiProperty({ enum: ['up', 'down'] }) postgres!: 'up' | 'down';
  @ApiProperty({ enum: ['up', 'down'] }) redis!: 'up' | 'down';
  @ApiProperty({ enum: ['up', 'down'] }) objectStorage!: 'up' | 'down';
}

export class ReadinessResponseDto implements ReadinessResponse {
  @ApiProperty({ example: 'ok' }) status!: 'ok';
  @ApiProperty({ example: 'eventflow-api' }) service!: 'eventflow-api';
  @ApiProperty({ format: 'date-time' }) timestamp!: string;
  @ApiProperty({ type: HealthDependenciesDto }) dependencies!: HealthDependenciesDto;
}

export class ReadinessFailureResponseDto implements ReadinessFailureResponse {
  @ApiProperty({ example: 'error' }) status!: 'error';
  @ApiProperty({ example: 'eventflow-api' }) service!: 'eventflow-api';
  @ApiProperty({ format: 'date-time' }) timestamp!: string;
  @ApiProperty({ type: HealthDependenciesDto }) dependencies!: HealthDependenciesDto;
}
