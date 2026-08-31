import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Unique,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Product } from './product.entity';
import { Branch } from '../../branches/entities/branch.entity';

// ProductBranch — რომელ ფილიალებში იყიდება კონკრეტული პროდუქტი + მისი
// ცალკე მარაგი (stock) იმ ფილიალში. ProductColor-ის იგივე bulk-set
// პატერნით იმართება (იხ. ProductsService.setBranches) — PUT-ზე მთლიანად
// ანაცვლებს წინა მდგომარეობას. checkout-ის "ფილიალიდან გატანა" სია
// (BranchesService.findAvailableForProducts) ამ ცხრილს კითხულობს.
@Entity()
@Unique(['productId', 'branchId'])
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

  // ამ ფილიალის მარაგი ამ პროდუქტისთვის — product.stock-ისგან და
  // ProductColor.stock-ისგან დამოუკიდებელი დამატებითი განზომილება (v1-ში
  // ფერი და ფილიალი ერთმანეთთან ჯვარედინად არ არის შეჯერებული).
  @Column('int', { default: 0 })
  stock!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
