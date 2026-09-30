import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { InfrastructureModule } from '../infrastructure/infrastructure.module';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationFactory } from './notification-factory.service';
import { NotificationsController } from './notifications.controller';
import { OutboxDispatcher } from './outbox-dispatcher.service';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [PrismaModule, AuthModule, InfrastructureModule],
  controllers: [NotificationsController],
  providers: [NotificationsGateway, NotificationsService, NotificationFactory, OutboxDispatcher],
  exports: [NotificationFactory, NotificationsService, NotificationsGateway],
})
export class NotificationsModule {}
