import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Unique,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Product } from '../../products/entities/product.entity';

// ერთი მომხმარებელი ერთ პროდუქტს მხოლოდ ერთხელ ამატებს ფავორიტებში —
// unique constraint (user, product) წყვილზე, cart-item-ის dedup ლოგიკის
// ნაცვლად პირდაპირ ბაზის დონეზე ვიცავთ.
@Entity()
@Unique(['user', 'product'])
export class Favorite {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn()
  user!: User;

  // პროდუქტის წაშლისას ფავორიტების ჩანაწერიც შლის — orphan FK არ რჩება.
  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn()
  product!: Product;

  @CreateDateColumn()
  createdAt!: Date;
}
