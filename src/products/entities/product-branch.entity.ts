import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Product } from './product.entity';
import { Branch } from '../../branches/entities/branch.entity';
import { ProductVariant } from './product-variant.entity';
import { Color } from '../../colors/entities/color.entity';

// ProductBranch — რომელ ფილიალებში იყიდება კონკრეტული პროდუქტი (ან მისი
// კონკრეტული ვარიანტი/ფერი) + მისი ცალკე მარაგი (stock) იმ ფილიალში.
// ProductColor-ის იგივე bulk-set პატერნით იმართება (იხ.
// ProductsService.setBranches) — PUT-ზე მთლიანად ანაცვლებს წინა
// მდგომარეობას. checkout-ის "ფილიალიდან გატანა" სია
// (BranchesService.findAvailableForProducts) ამ ცხრილს კითხულობს.
//
// variantId/colorId ორივე ნელაბლ-ია და ურთიერთგამომრიცხავია (ProductsService
// ამოწმებს): ვარიანტიან პროდუქტზე row-ს variantId აქვს, ძველი ფლეთი
// ფერიან პროდუქტზე — colorId, ხოლო მარტივ (ვარიანტების/ფერების გარეშე)
// პროდუქტზე ორივე null-ია ("flat" row). სამივე შემთხვევა calc-ურად
// განცალკევებულია partial unique ინდექსებით ქვემოთ — ერთ (productId,
// branchId) წყვილზე შეიძლება ერთდროულად არსებობდეს ერთი flat row, ან
// რამდენიმე variant-row (თითო variantId-ზე ერთი), ან რამდენიმე color-row
// (თითო colorId-ზე ერთი).
@Entity()
@Index('UQ_product_branch_flat', ['productId', 'branchId'], {
  unique: true,
  where: '"variantId" IS NULL AND "colorId" IS NULL',
})
@Index('UQ_product_branch_variant', ['productId', 'branchId', 'variantId'], {
  unique: true,
  where: '"variantId" IS NOT NULL',
})
@Index('UQ_product_branch_color', ['productId', 'branchId', 'colorId'], {
  unique: true,
  where: '"colorId" IS NOT NULL',
})
export class ProductBranch {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'productId' })
  product!: Product;

  @Column()
  productId!: number;

  @ManyToOne(() => Branch, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'branchId' })
  branch!: Branch;

  @Column()
  branchId!: number;

  // თუ ეს row ProductVariant-ზეა (ფერი+ზომის კომბინაცია) — ამ ფილიალის
  // მარაგი კონკრეტულად ამ ვარიანტისთვისაა, არა მთლიანი პროდუქტისთვის.
  @ManyToOne(() => ProductVariant, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'variantId' })
  variant?: ProductVariant;

  @Column({ type: 'uuid', nullable: true })
  variantId?: string | null;

  // ძველი ფლეთი (ProductColor) ფერიანი პროდუქტებისთვის — variantId-ის
  // ალტერნატივა, ორივე ერთდროულად ერთ row-ზე არ დაიშვება.
  @ManyToOne(() => Color, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'colorId' })
  color?: Color;

  @Column({ type: 'uuid', nullable: true })
  colorId?: string | null;

  // ამ ფილიალის მარაგი ამ პროდუქტისთვის/ვარიანტისთვის — product.stock-ისგან
  // და ProductColor.stock-ისგან/ProductVariant.stock-ისგან დამოუკიდებელი
  // დამატებითი განზომილება.
  @Column('int', { default: 0 })
  stock!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
