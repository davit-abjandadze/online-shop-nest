import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { Translations } from '../../common/types/translations.type';

// Color — წინასწარ განსაზღვრული ფერების ბიბლიოთეკა (ადმინი ცალკე ქმნის),
// პროდუქტს product_color join-ით ერთვის (იხ. ProductColor,
// src/products/entities/product-color.entity.ts) — თითო ფერზე ცალკე
// მარაგის (stock) რაოდენობით.
@Entity()
export class Color {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // მრავალენოვანი სახელი (ka/en/ru) — JSONB, ka ყოველთვის სავალდებულოა.
  @Column('jsonb', { default: {} })
  translations!: Translations<{ name: string }>;

  // HEX კოდი (მაგ. `#FF0000`) — frontend-ზე ფერის ბუშტის/სვოჩის გამოსატანად.
  @Column({ nullable: true })
  hexCode?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
