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

// ProductColor — კონკრეტული პროდუქტისთვის არჩეული ფერი + მისი საწყობის
// ცალკე მარაგი (stock). ProductAttributeValue-ის იგივე bulk-set პატერნით
// იმართება (იხ. ProductsService.setColors) — PUT-ზე მთლიანად ანაცვლებს
// წინა მდგომარეობას.
@Entity()
@Unique(['productId', 'colorId'])
export class ProductColor {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'productId' })
  product!: Product;

  @Column()
  productId!: number;

  @ManyToOne(() => Color, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'colorId' })
  color!: Color;

  @Column()
  colorId!: string;

  // ამ კონკრეტული ფერის მარაგი საწყობში — product.stock-ისგან დამოუკიდებელი
  // (Product.stock ჯამურ/ვარიანტების-გარეშე მარაგს ინახავს, თუ ფერები
  // მითითებულია, frontend/admin-მა ეს stock უნდა გამოიყენოს ცალკეულ
  // ფერზე დარჩენილი რაოდენობისთვის).
  @Column('int', { default: 0 })
  stock!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
