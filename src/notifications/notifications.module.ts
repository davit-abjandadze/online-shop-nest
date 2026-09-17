import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './entities/notification.entity';
import { NotificationRecipient } from './entities/notification-recipient.entity';
import { User } from '../users/entities/user.entity';
import { NotificationsController } from './notifications.controller';
import { NotificationsUserController } from './notifications-user.controller';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification, NotificationRecipient, User]),
  ],
  controllers: [NotificationsController, NotificationsUserController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
