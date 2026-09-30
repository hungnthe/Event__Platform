import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { EventsModule } from '../events/events.module';
import { InfrastructureModule } from '../infrastructure/infrastructure.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AttachmentsController } from './attachments.controller';
import { AttachmentsService } from './attachments.service';

@Module({ imports: [PrismaModule, InfrastructureModule, EventsModule, AuthModule, AuditModule], controllers: [AttachmentsController], providers: [AttachmentsService] })
export class AttachmentsModule {}
