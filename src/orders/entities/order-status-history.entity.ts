import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  CreateDateColumn,
} from 'typeorm';
import { Order } from './order.entity';
import { OrderStatus } from './order-status.enum';
import { User } from '../../users/entities/user.entity';

// შეკვეთის სტატუსების ისტორია — ფრონტის order-tracking timeline-ისთვის
// (pending → paid → processing → shipped → delivered, cancelled/expired
// ტერმინალურია). ყოველი status-ცვლილება — ადმინის ხელით, BOG webhook-ით
// (pending → paid), თუ cron-ის მიერ ვადაგასულის expire-ით — ერთი row-ით
// ფიქსირდება OrdersService-ის ცენტრალიზებული recordStatusHistory-ის მეშვეობით,
// რომ არც ერთი გადასვლა არ გამოგვრჩეს ცალკეული call site-ების დუბლირებით.
@Entity()
export class OrderStatusHistory {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @ManyToOne(() => Order, (order) => order.statusHistory, {
    onDelete: 'CASCADE',
  })
  @JoinColumn()
  order!: Order;

  @Column({ type: 'enum', enum: OrderStatus })
  status!: OrderStatus;

  // ვინ შეცვალა ხელით (ADMIN) — null სისტემური/ავტომატური გადასვლისას
  // (BOG callback pending→paid, cron-ის pending→expired). onDelete SET NULL,
  // რომ ადმინის წაშლა ისტორიულ ჩანაწერებს არ დააზიანოს. ინდექსი მომავალი
  // "ამ ადმინმა რა შეცვალა" ტიპის აუდიტ-query-ებისთვის (იხ. მიგრაცია).
  @Index()
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn()
  changedBy?: User;

  @CreateDateColumn()
  createdAt!: Date;
}
