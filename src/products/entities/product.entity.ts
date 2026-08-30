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

@Entity()
export class Product {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name!: string;

  @Column({ nullable: true })
  description?: string;

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

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
