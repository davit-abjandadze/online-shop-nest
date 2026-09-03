import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Unique,
  CreateDateColumn,
} from 'typeorm';
import { ProductSlider } from './product-slider.entity';
import { Product } from '../../products/entities/product.entity';

// ProductSlider-ის ერთი ელემენტი — რომელი პროდუქტია ბლოკში და რა
// რიგითობით ჩნდება (ProductColor.stock-ის იგივე junction-entity პატერნი).
// ორივე FK CASCADE-ია — სლაიდერის წაშლისას მისი items-იც იშლება
// (`cascade: true` OneToMany-ზე), პროდუქტის წაშლისას კი მხოლოდ ეს
// კონკრეტული ჩანაწერი (სლაიდერი კი რჩება, უბრალოდ ის პროდუქტი აღარ ჩანს).
@Entity()
@Unique(['productSliderId', 'productId'])
export class ProductSliderItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => ProductSlider, (productSlider) => productSlider.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'productSliderId' })
  productSlider!: ProductSlider;

  @Column()
  productSliderId!: string;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'productId' })
  product!: Product;

  @Column()
  productId!: number;

  // ხელით მითითებული რიგი ბლოკში — bulk set-ისას მასივის index-ს
  // შეესაბამება (იხ. ProductSlidersService.setItems).
  @Column('int', { default: 0 })
  sortOrder!: number;

  @CreateDateColumn()
  createdAt!: Date;
}
