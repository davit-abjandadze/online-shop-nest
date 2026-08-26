import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  Tree,
  TreeChildren,
  TreeParent,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Product } from '../../products/entities/product.entity';

// კატეგორია ახლა თვითრეფერენციული ხეა (closure-table პატერნი, TypeORM-ის
// ჩაშენებული @Tree მხარდაჭერით) — შვილების/წინაპრების/breadcrumb query-სთვის
// TreeRepository გამოიყენება (findDescendants/findAncestors/findTrees),
// იხ. category.service.ts. id გადავიდა uuid-ზე (მანამდე auto-increment
// integer იყო), რადგან ეს ბაზისური ცხრილია, საიდანაც slug/url-ები გამომდის.
@Entity()
@Tree('closure-table')
export class Category {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  nameKa!: string;

  @Column()
  nameEn!: string;

  @Column({ unique: true })
  slug!: string;

  @Column({ default: true })
  isActive!: boolean;

  // ხელით მითითებული დალაგების რიგი (admin-ის tree editor-ისთვის) — createdAt
  // დალაგება რეალურ shop-ში კატეგორიების მენიუსთვის უადგილოა.
  @Column('int', { default: 0 })
  sortOrder!: number;

  @Column({ nullable: true })
  image?: string;

  @Column({ nullable: true })
  seoTitle?: string;

  @Column({ nullable: true })
  seoDescription?: string;

  @Column({ nullable: true })
  seoKeywords?: string;

  // მშობელი კატეგორია — წაშლა აკრძალულია (RESTRICT), სანამ შვილები
  // არსებობენ, რომ ხე შემთხვევით არ დაინგრეს; წაშლამდე service-ში
  // ცალსახად მოწმდება და მკაფიო შეცდომა ბრუნდება.
  @TreeParent({ onDelete: 'RESTRICT' })
  parent?: Category | null;

  @TreeChildren()
  children?: Category[];

  // Product მხარეს onDelete: 'SET NULL' დგას — კატეგორიის წაშლა პროდუქტებს
  // არ შლის, უბრალოდ category-ს null-ად აქცევს. (ფაზა 4-ში გადავა
  // many-to-many-ზე product_category join-ით.)
  @OneToMany(() => Product, (product) => product.category)
  products?: Product[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
