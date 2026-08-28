import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Product } from './product.entity';

// ProductAdditionalInfo — პროდუქტის მთავარი name/description-ის გარდა,
// ადმინს შესაძლებლობა აქვს კონკრეტულ პროდუქტს დაუმატოს ულიმიტო რაოდენობის
// დამატებითი ინფორმაციის ბლოკი (თითო — სათაური + აღწერილობა). მაგ.
// "მიწოდება", "გარანტია", "შენახვის პირობები" და ა.შ. sortOrder განსაზღვრავს
// ბლოკების თანმიმდევრობას პროდუქტის გვერდზე.
@Entity()
export class ProductAdditionalInfo {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'productId' })
  product!: Product;

  @Column()
  productId!: number;

  @Column()
  title!: string;

  @Column('text')
  description!: string;

  @Column('int', { default: 0 })
  sortOrder!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
