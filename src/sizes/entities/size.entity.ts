import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { Translations } from '../../common/types/translations.type';

// Size — გლობალური ზომების ბიბლიოთეკა (Color-ის იგივე პატერნი), მაგ.
// მანქანის ტენტისთვის "Sedan hatchback [3.4m - 3.6m]" + კოდი "2S".
// კონკრეტულ პროდუქტზე მიბმა/მარაგი/ფასი ProductVariant-შია (Product ↔
// Size ↔ Color კომბინაცია, იხ. product-variant.entity.ts).
@Entity()
export class Size {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('jsonb', { default: {} })
  translations!: Translations<{ name: string }>;

  // მოკლე კოდი admin/frontend-ის dropdown-ისთვის (მაგ. "2S", "3XL") —
  // ცალკეა translations.name-ისგან, რომ ცხრილურ/კომპაქტურ ჩვენებაში
  // (მაგ. ვარიანტების matrix) სრული აღწერის მაგივრად ეს გამოჩნდეს.
  @Column()
  code!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
