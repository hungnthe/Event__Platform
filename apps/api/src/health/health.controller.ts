import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common'; import type { ReadinessResponse } from '@eventflow/contracts'; import { ApiOkResponse, ApiOperation, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger'; import { HealthService } from './health.service'; import { ReadinessFailureResponseDto, ReadinessResponseDto } from './dto/health-response.dto';

@ApiTags('health') @Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}
  @Get('live') @HttpCode(HttpStatus.OK) @ApiOperation({ summary: 'Liveness probe' }) @ApiOkResponse({ type: ReadinessResponseDto })
  live() { return this.healthService.live(); }
  @Get('ready') @ApiOperation({ summary: 'Readiness probe with dependency checks' }) @ApiOkResponse({ type: ReadinessResponseDto }) @ApiServiceUnavailableResponse({ type: ReadinessFailureResponseDto })
  ready(): Promise<ReadinessResponse> { return this.healthService.ready(); }
}
