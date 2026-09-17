import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Notification } from './notification.entity';

// join-ცხრილი Notification-სა და User-ს შორის — თითო row ერთი user-ის
// მიმართ ერთი შეტყობინების read-სტატუსია. (notificationId, userId) წყვილი
// უნიკალურია (ერთხელ გაგზავნილი შეტყობინება ერთხელ ჩანს user-ის სიაში),
// ხოლო (userId, isRead) ინდექსი unread-count/list ენდფოინთების query-ს ემსახურება.
@Entity()
@Index(['notificationId', 'userId'], { unique: true })
@Index(['userId', 'isRead'])
export class NotificationRecipient {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Notification, (notification) => notification.recipients, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'notificationId' })
  notification: Notification;

  @Column()
  notificationId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: number;

  @Column({ default: false })
  isRead: boolean;

  @Column({ type: 'timestamp', nullable: true })
  readAt?: Date | null;
}
