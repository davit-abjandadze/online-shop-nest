import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { OrderItem } from './order-item.entity';

export enum OrderStatus {
  PENDING = 'pending', // შეიქმნა, ელოდება გადახდას
  PAID = 'paid',
  PROCESSING = 'processing', // მიმდინარეობს დამუშავება/გაგზავნის მომზადება
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired', // ვადა გავიდა (გადაუხდელი), ავტომატურად cron-ის მიერ
}

@Entity()
export class Order {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => User)
  @JoinColumn()
  user!: User;

  @OneToMany(() => OrderItem, (item) => item.order, { cascade: true })
  items!: OrderItem[];

  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.PENDING })
  status!: OrderStatus;

  // ფული — არასდროს float, ყოველთვის decimal ფიქსირებული precision-ით.
  @Column('decimal', { precision: 10, scale: 2 })
  totalAmount!: string;

  @Column({ default: 'GEL' })
  currency!: string;

  // v1-ისთვის მარტივი string მისამართი — სტრუქტურირებული Address
  // შემდგომში დაემატება, საჭიროების შემთხვევაში.
  @Column()
  shippingAddress!: string;

  // PENDING შეკვეთის გადახდის ვადა — cron (Phase 5) ამოწმებს ამ ველს და
  // ვადაგასულ, გადაუხდელ შეკვეთებს EXPIRED-ში გადაჰყავს + აბრუნებს მარაგს.
  @Column({ type: 'timestamptz', nullable: true })
  expiresAt?: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
