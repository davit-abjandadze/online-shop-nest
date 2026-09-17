import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
  CreateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { NotificationRecipient } from './notification-recipient.entity';
import { NotificationAction } from '../dto/notification-action.dto';

// ადმინის მიერ გაგზავნილი შეტყობინება (bell/dropdown/modal პატერნი) —
// contentHtml წინასწარ sanitize-ებულია (NotificationsService.create-ში,
// sanitize-html-ით) შენახვამდე, ამიტომ სვეტში უკვე უსაფრთხო HTML ინახება.
// მიმღებები ცალკე NotificationRecipient ცხრილშია (თითო user-ს თავისი
// read-სტატუსი), რომ ერთი შეტყობინება "ყველასთვის" ან კონკრეტული
// user(ებ)-სთვის გაგზავნა ერთნაირად შესძლოს.
@Entity()
export class Notification {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column('text')
  contentHtml: string;

  @Column({ nullable: true })
  imageUrl?: string;

  // მოდალის ღილაკები (close/link) — იხ. NotificationActionDto ვალიდაციისთვის.
  @Column({ type: 'jsonb', nullable: true })
  actions?: NotificationAction[] | null;

  // ვინ გამოგზავნა — user-ის წაშლის შემთხვევაში ისტორია არ იშლება,
  // უბრალოდ ავტორი null-ად იქცევა.
  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'createdByUserId' })
  createdBy?: User | null;

  @Column({ type: 'int', nullable: true })
  createdByUserId?: number | null;

  @OneToMany(() => NotificationRecipient, (recipient) => recipient.notification)
  recipients?: NotificationRecipient[];

  @CreateDateColumn()
  createdAt: Date;
}
