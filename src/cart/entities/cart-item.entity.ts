import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Cart } from './cart.entity';
import { Product } from '../../products/entities/product.entity';
import { Color } from '../../colors/entities/color.entity';

@Entity()
export class CartItem {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Cart, (cart) => cart.items, { onDelete: 'CASCADE' })
  @JoinColumn()
  cart!: Cart;

  // პროდუქტის წაშლა კალათაშიც შლის შესაბამის ჩანაწერს — orphan FK არ რჩება.
  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn()
  product!: Product;

  // თუ პროდუქტს ფერები აქვს მითითებული (ProductColor), აქ ინახება
  // არჩეული ფერი — CartService.addItem ამოწმებს, რომ colorId სავალდებულოა
  // ასეთი პროდუქტისთვის და ფერის საკუთარ stock-ს ადარებს (არა
  // product.stock-ს). ფერის წაშლა კალათაშიც შლის ჩანაწერს.
  @ManyToOne(() => Color, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'colorId' })
  color?: Color;

  @Column({ type: 'uuid', nullable: true })
  colorId?: string | null;

  // ფასს აქ არ ვინახავთ — კალათა "ცოცხალი" კალათაა, საბოლოო ფასი
  // ყოველთვის product.price-დან იკითხება checkout-ის დროს (Order-ში ხდება
  // snapshot). რაოდენობის ვალიდურობას (> 0) DTO ამოწმებს.
  @Column('int')
  quantity!: number;
}
