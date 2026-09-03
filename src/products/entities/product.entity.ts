import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Category } from '../../category/entities/category.entity';
import { Company } from '../../companies/entities/company.entity';
import type { Translations } from '../../common/types/translations.type';

@Entity()
export class Product {
  @PrimaryGeneratedColumn()
  id!: number;

  // მრავალენოვანი სახელი/აღწერა (ka/en/ru) — JSONB, ka ყოველთვის
  // სავალდებულოა (description ka-ზეც სურვილისამებრ). storefront-ისთვის
  // resolveTranslation-ით ამოღებული name/description controller
  // response-ში enrich-დება (იხ. products.controller.ts).
  @Column('jsonb', { default: {} })
  translations!: Translations<{ name: string; description?: string }>;

  // ფული — arway float, ყოველთვის decimal ფიქსირებული precision-ით.
  @Column('decimal', { precision: 10, scale: 2 })
  price!: string;

  @Column('int', { default: 0 })
  stock!: number;

  // ფასდაკლება პროცენტებში (0-100) — თუ დაყენებულია, ფრონტი პასუხისმგებელია
  // საბოლოო ფასდაკლებული ფასის გამოთვლაზე (price - price * discountPercent / 100).
  @Column('int', { nullable: true })
  discountPercent?: number;

  // მარტივი სურათების სია v1-ისთვის — csv-ის მსგავსად ინახება, ცალკე ცხრილი
  // ჯერჯერობით ზედმეტია.
  @Column('simple-array', { nullable: true })
  images?: string[];

  // პროდუქტის გვერდზე ჩასართველი YouTube ვიდეო (მიმოხილვა/ინსტრუქცია) — მხოლოდ
  // ერთი ლინკია საკმარისი v1-ისთვის, embed URL-ად frontend-ი გარდაქმნის.
  @Column({ nullable: true })
  videoUrl?: string;

  // გაბარიტები (კგ/სმ) — არასავალდებულო, ძირითადად მიწოდების ღირებულების
  // გამოსათვლელად ან პროდუქტის დეტალურ ინფორმაციაში საჩვენებლად.
  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  weight?: string;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  length?: string;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  width?: string;

  @Column({ default: true })
  isActive!: boolean;

  // კატეგორიის წაშლისას პროდუქტი არ იშლება, უბრალოდ category null ხდება.
  @ManyToOne(() => Category, (category) => category.products, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn()
  category?: Category;

  // რომელ კომპანიას ეკუთვნის ეს პროდუქტი — CreateProductDto-ში სავალდებულოა
  // (ბიზნეს-წესი), მაგრამ FK column nullable-ია (category-ის იგივე SET NULL
  // პატერნი), რომ კომპანიის წაშლამ პროდუქტები არ წაშალოს.
  @ManyToOne(() => Company, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn()
  company?: Company;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
