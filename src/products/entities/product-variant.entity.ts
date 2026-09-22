import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Unique,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Product } from './product.entity';
import { Color } from '../../colors/entities/color.entity';
import { Size } from '../../sizes/entities/size.entity';

// ProductVariant — Product ↔ Color ↔ Size კომბინირებული ვარიანტი, თავისი
// ცალკე stock-ითა და price-ით (მაგ. მანქანის ტენტი: ფერი + ზომა ერთად
// განსაზღვრავს კონკრეტულ პროდუქტს, სხვადასხვა ზომას სხვადასხვა ფასი
// აქვს). colorId/sizeId ორივე ნელაბლ-ია — პროდუქტს შეუძლია მხოლოდ
// ზომების (ფერის გარეშე) ან მხოლოდ ფერების (ზომის გარეშე) ვარიანტებიც
// ჰქონდეს, თუმცა ეს ცალკეა ProductColor-ისგან (ProductsService.setColors) —
// ორივე სისტემა ერთსა და იმავე პროდუქტზე ერთდროულად არ არის განკუთვნილი
// გამოსაყენებლად. product.price/stock ამ სისტემასთან უცვლელი რჩება —
// price მხოლოდ stock-ის ჯამზეა სინქრონული (setColors-ის იგივე პატერნი),
// price კი per-variant-ია, single product.price-ს არაფერს არ ცვლის.
@Entity()
@Unique(['productId', 'colorId', 'sizeId'])
export class ProductVariant {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'productId' })
  product!: Product;

  @Column()
  productId!: number;

  @ManyToOne(() => Color, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'colorId' })
  color?: Color;

  @Column({ type: 'uuid', nullable: true })
  colorId?: string | null;

  @ManyToOne(() => Size, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'sizeId' })
  size?: Size;

  @Column({ type: 'uuid', nullable: true })
  sizeId?: string | null;

  @Column('int', { default: 0 })
  stock!: number;

  // ვარიანტის საკუთარი ფასი — თუ null-ია, product.price გამოიყენება
  // (fallback), setVariants-ს არ მოეთხოვება ყოველ ვარიანტზე ფასის
  // მითითება.
  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  price?: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
