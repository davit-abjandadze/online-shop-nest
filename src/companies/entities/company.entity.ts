import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

// კომპანია (მაღაზიის ქსელი/ბრენდი), რომელსაც ეკუთვნის ერთი ან მეტი ფილიალი
// და მისი პროდუქტები. ADMIN მართავს — Category/Branch-ის იგივე public-GET/
// ADMIN-write გამიჯვნა (იხ. CompaniesController).
@Entity()
export class Company {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column({ nullable: true })
  description?: string;

  // კომპანიის ლოგო — checkout-ზე ფილიალების სიაში საჩვენებლად (Branch.company
  // relation-ის საშუალებით). ცალკე ცხრილი ჯერ არ სჭირდება, Product.images-ის
  // მსგავსად უბრალო URL-ია საკმარისი.
  @Column({ nullable: true })
  logoUrl?: string;

  @Column({ default: true })
  isActive!: boolean;

  @Column('int', { default: 0 })
  sortOrder!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
