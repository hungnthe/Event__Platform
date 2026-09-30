import { Module } from '@nestjs/common'; import { InfrastructureModule } from '../infrastructure/infrastructure.module'; import { HealthController } from './health.controller'; import { HealthService } from './health.service';
@Module({ imports: [InfrastructureModule], controllers: [HealthController], providers: [HealthService] }) export class HealthModule {}
