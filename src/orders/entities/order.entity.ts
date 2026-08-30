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
import { Branch } from '../../branches/entities/branch.entity';

// მიწოდების ხერხი — საკურიერო მომსახურება ან ფილიალიდან თვითგატანა.
export enum DeliveryMethod {
  COURIER = 'courier',
  PICKUP = 'pickup',
}

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

  @Column({
    type: 'enum',
    enum: DeliveryMethod,
    default: DeliveryMethod.COURIER,
  })
  deliveryMethod!: DeliveryMethod;

  // "ფილიალიდან გატანა"-ს შემთხვევაში აქ ინახება არჩეული ფილიალი — nullable,
  // რადგან საკურიერო შეკვეთებს ფილიალი არ სჭირდება. onDelete SET NULL,
  // რომ ფილიალის წაშლისას ძველი შეკვეთები არ დაზიანდეს.
  @ManyToOne(() => Branch, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn()
  branch?: Branch;

  // v1-ისთვის მარტივი string მისამართი — სტრუქტურირებული Address
  // შემდგომში დაემატება, საჭიროების შემთხვევაში. Pickup-ის შემთხვევაში
  // აქ ფილიალის მისამართი ინახება (ჩვენებისთვის), courier-ის შემთხვევაში
  // კი — სავალდებულოა.
  @Column({ nullable: true })
  shippingAddress?: string;

  // PENDING შეკვეთის გადახდის ვადა — cron (Phase 5) ამოწმებს ამ ველს და
  // ვადაგასულ, გადაუხდელ შეკვეთებს EXPIRED-ში გადაჰყავს + აბრუნებს მარაგს.
  @Column({ type: 'timestamptz', nullable: true })
  expiresAt?: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
