import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Order } from '../../orders/entities/order.entity';

// v1-ში მხოლოდ BOG-ია, მაგრამ enum-ად ვინახავთ, რომ TBC-ის (ან სხვა
// პროვაიდერის) დამატებისას სვეტის ტიპი არ შეიცვალოს.
export enum PaymentProvider {
  BOG = 'bog',
  MOCK = 'mock',
}

// BOG-ის callback-ის `order_status.key` ვოკაბულარის 1:1 ანარეკლი — ცალკე
// თარგმანის შრე მხოლოდ მეორე პროვაიდერის საჭიროებისას დაემატება.
export enum PaymentStatus {
  CREATED = 'created',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  REJECTED = 'rejected',
  REFUNDED = 'refunded',
  PARTIAL_COMPLETED = 'partial_completed',
}

@Entity()
export class Payment {
  @PrimaryGeneratedColumn()
  id!: number;

  // ერთ შეკვეთას — ერთი გადახდა (ხელახლა initiate-ის შემთხვევაში ახალი
  // provider-order იქმნება მხოლოდ თუ ეს Payment ჯერ COMPLETED არაა).
  @OneToOne(() => Order)
  @JoinColumn()
  order!: Order;

  @Column({
    type: 'enum',
    enum: PaymentProvider,
    default: PaymentProvider.BOG,
  })
  provider!: PaymentProvider;

  // პროვაიდერის მხარეს შექმნილი გადახდის ID (BOG-ის შემთხვევაში create-order
  // პასუხის `id` — callback-შიც იგივე მოდის, რითაც ვპოულობთ ამ Payment-ს).
  // ⚠️ ფიქსი: findOne({ where: { providerOrderId }})-ს ყოველ BOG callback-ზე
  // ვხმართავთ (PaymentsService.handleCallback) — ინდექსის გარეშე ეს Postgres-ს
  // ყოველ callback-ზე სრულ sequential scan-ს აიძულებდა ცხრილის ზრდასთან
  // ერთად, და ვერაფერი უშლიდა ხელს ორ სხვადასხვა Payment row-ს ერთი და იმავე
  // providerOrderId ჰქონოდა. Unique ინდექსი NULL-ებზე არ მოქმედებს (Postgres-ში
  // მრავალი NULL დაშვებულია), ამიტომ jest ჯერ არ initiate-ილ Payment-ებს არ
  // ეხება.
  @Index({ unique: true })
  @Column({ nullable: true })
  providerOrderId?: string;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.CREATED,
  })
  status!: PaymentStatus;

  // ბოლო შექმნილი checkout-ის ბმული და მისი ვადა (BOG-ის ttl). ხელახალი
  // initiate ცოცხალ checkout-ს ხელახლა იყენებს, ახალს არ ქმნის — თორემ
  // providerOrderId გადაიწერებოდა და ძველ (ჯერ კიდევ გადახდად) გვერდზე
  // გადახდილი თანხის callback ვეღარ დაუკავშირდებოდა Payment-ს (404).
  @Column({ type: 'varchar', nullable: true })
  redirectUrl?: string | null;

  @Column({ type: 'timestamp', nullable: true })
  checkoutExpiresAt?: Date | null;

  // ბოლო callback-ის ნედლი სხეული — აუდიტისთვის/დებაგისთვის ვინახავთ.
  @Column('jsonb', { nullable: true })
  rawCallbackPayload?: Record<string, any>;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
