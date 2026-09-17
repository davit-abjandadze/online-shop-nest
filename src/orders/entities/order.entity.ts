import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { OrderItem } from './order-item.entity';
import { Branch } from '../../branches/entities/branch.entity';
import { OrderStatusHistory } from './order-status-history.entity';
import { OrderStatus } from './order-status.enum';

// OrderStatus ცალკე ფაილშია (order-status.enum.ts) — იხ. იმ ფაილის კომენტარი
// წრიული import-ის პრობლემის შესახებ. აქ რე-ექსპორტია, რომ არსებული
// `import { OrderStatus } from './order.entity'` (payments.service.ts,
// dto/update-order-status.dto.ts და სხვ.) არ დაგვჭირვებოდა ცვლილება.
export { OrderStatus };

// მიწოდების ხერხი — საკურიერო მომსახურება ან ფილიალიდან თვითგატანა.
export enum DeliveryMethod {
  COURIER = 'courier',
  PICKUP = 'pickup',
}

@Entity()
export class Order {
  @PrimaryGeneratedColumn()
  id!: number;

  // @Index — "ჩემი შეკვეთები" (GET /orders own-scope) და OrdersService-ის
  // სხვა userId-ზე გაფილტრული queries-ები ინდექსის გარეშე sequential
  // scan-ს გაუშვებდა ცხრილის ზრდასთან ერთად.
  @Index()
  @ManyToOne(() => User)
  @JoinColumn()
  user!: User;

  @OneToMany(() => OrderItem, (item) => item.order, { cascade: true })
  items!: OrderItem[];

  // Timeline-ისთვის (GET /orders/:id) — createFromCart/updateStatus/
  // expireStaleOrders-ის ცენტრალიზებული recordStatusHistory-ით ივსება,
  // იხ. OrderStatusHistory.
  @OneToMany(() => OrderStatusHistory, (h) => h.order)
  statusHistory?: OrderStatusHistory[];

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

  // მარაგი უკვე დაბრუნებულია თუ არა ამ შეკვეთისთვის — status-ის (CANCELLED/
  // EXPIRED) მხოლოდ დროებითი მნიშვნელობის ნაცვლად ცალკე persist-ული flag-ია,
  // რომ cancel → reopen → cancel-ის ციკლმა (ან cron-ის/ადმინის ხელით EXPIRED-ზე
  // გადაყვანის ორმაგმა ტრიგერმა) მარაგი ორჯერ არ დააბრუნოს/საერთოდ არ დაკარგოს
  // (იხ. OrdersService.updateStatus/expireStaleOrders).
  @Column({ default: false })
  stockRestored!: boolean;

  // @Index — StatsService-ის overview/revenue/status-breakdown ყველა
  // endpoint-ი createdAt-ზე filter-ავს/date_trunc-ავს (BETWEEN :from AND
  // :to) — ინდექსის გარეშე ეს sequential scan-ია ცხრილის ზრდასთან ერთად.
  @Index()
  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
