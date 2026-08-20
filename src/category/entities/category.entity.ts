import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Product } from '../../products/entities/product.entity';

@Entity()
export class Category {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name!: string;

  @Column({ nullable: true })
  description?: string;

  // Product მხარეს onDelete: 'SET NULL' დგას — კატეგორიის წაშლა პროდუქტებს
  // არ შლის, უბრალოდ category-ს null-ად აქცევს.
  @OneToMany(() => Product, (product) => product.category)
  products?: Product[];
}
