import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { DelegatedPermissionsController } from './delegated-permissions.controller';
import { DelegatedPermissionsService } from './delegated-permissions.service';
import { EventAccessService } from './event-access.service';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { MembersController } from './members.controller';
import { MembersService } from './members.service';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { WorkflowController } from './workflow.controller';
import { WorkflowService } from './workflow.service';
import { EventProgressService } from './event-progress.service';

@Module({
  imports: [PrismaModule, AuthModule, AuditModule, NotificationsModule],
  controllers: [EventsController, MembersController, TasksController, DelegatedPermissionsController, WorkflowController],
  providers: [EventAccessService, EventProgressService, EventsService, MembersService, TasksService, DelegatedPermissionsService, WorkflowService],
  exports: [EventAccessService],
})
export class EventsModule {}
