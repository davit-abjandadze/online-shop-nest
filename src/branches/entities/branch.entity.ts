import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Company } from '../../companies/entities/company.entity';

// კვირის ერთი დღის სამუშაო საათები — `null` მნიშვნელობა ნიშნავს, რომ
// ფილიალი ამ დღეს დახურულია.
export interface BranchDayHours {
  open: string;
  close: string;
}

export interface BranchWorkingHours {
  mon: BranchDayHours | null;
  tue: BranchDayHours | null;
  wed: BranchDayHours | null;
  thu: BranchDayHours | null;
  fri: BranchDayHours | null;
  sat: BranchDayHours | null;
  sun: BranchDayHours | null;
}

// ფიზიკური ფილიალები, საიდანაც checkout-ზე "ფილიალიდან გატანა" შესაძლებელია.
// ადმინი მართავს (CategoryModule-ის ანალოგიური public-GET/ADMIN-write გამიჯვნა),
// checkout კი GET /branches-ს (მხოლოდ აქტიურები) კითხულობს.
@Entity()
export class Branch {
  @PrimaryGeneratedColumn()
  id!: number;

  // მფლობელი კომპანია — ფილიალის წაშლა/მარაგის შემოწმება ყოველთვის
  // კონკრეტულ კომპანიას ეკუთვნის. კომპანიის წაშლისას მისი ფილიალებიც
  // შვილურად იშლება (CASCADE) — Order-ის branch relation-ზე SET NULL დგას
  // ცალკე, ამიტომ ძველი შეკვეთები არ ზიანდება.
  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'companyId' })
  company!: Company;

  @Column()
  companyId!: string;

  // ფილიალის დასახელება/ლოკაცია — მაგ. "ჯ. თბილისი, ვაკე".
  @Column()
  title!: string;

  @Column()
  address!: string;

  @Column()
  phoneNumber!: string;

  @Column({ nullable: true })
  email?: string;

  @Column('decimal', { precision: 10, scale: 6 })
  latitude!: number;

  @Column('decimal', { precision: 10, scale: 6 })
  longitude!: number;

  @Column('jsonb')
  workingHours!: BranchWorkingHours;

  // დახურული/დროებით გამოთვლილი ფილიალი checkout-ის სიაში არ ჩნდება.
  @Column({ default: true })
  isActive!: boolean;

  // ხელით მითითებული თანმიმდევრობა checkout-ისა და ადმინის სიაში.
  @Column({ default: 0 })
  sortOrder!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
