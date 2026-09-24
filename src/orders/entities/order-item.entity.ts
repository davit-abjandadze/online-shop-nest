import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Order } from './order.entity';
import { Product } from '../../products/entities/product.entity';
import { Color } from '../../colors/entities/color.entity';
import { ProductVariant } from '../../products/entities/product-variant.entity';

@Entity()
export class OrderItem {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Order, (order) => order.items, { onDelete: 'CASCADE' })
  @JoinColumn()
  order!: Order;

  // FK ნელაბლ-ია განზრახ — პროდუქტის მომავალში წაშლა არ უნდა ანგრევდეს
  // ისტორიულ შეკვეთებს. სახელი/ფასი ცალკე ინახება (იხ. ქვემოთ).
  @ManyToOne(() => Product, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn()
  product?: Product;

  // თუ შეკვეთა კონკრეტულ ფერზეა გაფორმებული — FK ასევე ნელაბლ-ია (ფერის
  // მომავალში წაშლა ისტორიულ შეკვეთას არ უნდა ანგრევდეს). სახელი ცალკე
  // ინახება (colorName) იმავე snapshot-ლოგიკით, რაც productName-ს აქვს.
  @ManyToOne(() => Color, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'colorId' })
  color?: Color;

  @Column({ type: 'uuid', nullable: true })
  colorId?: string | null;

  @Column({ nullable: true })
  colorName?: string;

  // Snapshot — product.companyId შეკვეთის შექმნის მომენტში (product FK
  // ისევე SET NULL-ია, colorId/variantId-ის იგივე მიზეზით: კომპანიის ან
  // პროდუქტის წაშლა/გადანიშვნა არ უნდა ანგრევდეს სტატისტიკაში კომპანიის
  // მიხედვით ისტორიულ ფილტრაციას). ცალკე relation არ სჭირდება — მხოლოდ
  // filter/group-by-ისთვის გამოიყენება (იხ. StatsService).
  @Column({ type: 'uuid', nullable: true })
  companyId?: string | null;

  // ვარიანტზე (ProductVariant — ფერი+ზომა) გაფორმებული შეკვეთისთვის —
  // colorId-ის იგივე nullable+SET NULL პატერნი, sizeName snapshot-ი
  // colorName-ის ანალოგიური.
  @ManyToOne(() => ProductVariant, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'variantId' })
  variant?: ProductVariant;

  @Column({ type: 'uuid', nullable: true })
  variantId?: string | null;

  @Column({ nullable: true })
  sizeName?: string;

  // Snapshot შეკვეთის შექმნის მომენტში — არასდროს ვკითხულობთ ცოცხლად
  // product.name/product.price-ს, თორემ მომავალი ფასის ცვლილება ისტორიას გადაწერდა.
  @Column()
  productName!: string;

  @Column('decimal', { precision: 10, scale: 2 })
  unitPrice!: string;

  @Column('int')
  quantity!: number;
}
