import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  OneToMany,
  CreateDateColumn,
  JoinColumn,
  JoinTable,
  ManyToOne,
  ManyToMany,
} from 'typeorm';
import { Answer } from '../../answer/entities/answer.entity';
// რეკომენდებულია ფარდობითი გზა (relative path):
import { Category } from '../../category/entities/category.entity';
import { User } from '../../users/entities/user.entity';

// კითხვის ტიპები
export enum QuestionType {
  SINGLE = 'single', // ერთი პასუხის არჩევა (radio button)
  MULTIPLE = 'multiple', // რამდენიმე პასუხის მონიშვნა (checkbox)
}

// ვინ დასვა კითხვა — admin თუ ჩვეულებრივი user
export enum CreatorType {
  ADMIN = 'admin',
  USER = 'user',
}

// user-ის დასმული კითხვის განხილვის სტატუსი admin-ის მხრიდან
export enum ApprovalStatus {
  PENDING = 'pending', // ჯერ არ განხილულა
  APPROVED = 'approved', // admin-მა დაადასტურა
  REJECTED = 'rejected', // admin-მა უკუაგდო
}

@Entity()
export class Question {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  text!: string;

  @Column({
    type: 'enum',
    enum: QuestionType,
    default: QuestionType.SINGLE,
  })
  type!: QuestionType;

  @OneToMany(() => Answer, (answer) => answer.question, {
    cascade: true,
  })
  answers!: Answer[];

  // ერთ კითხვას შეიძლება ჰქონდეს რამდენიმე კატეგორია (many-to-many, join table: question_categories)
  @ManyToMany(() => Category, (category) => category.questions)
  @JoinTable({
    name: 'question_categories',
    joinColumn: { name: 'questionId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'categoryId', referencedColumnName: 'id' },
  })
  categories?: Category[];

  @Column({ default: true })
  isActive!: boolean;

  @Column({ type: 'timestamp', nullable: true })
  endDate?: Date | null;

  // ვინ დასვა კითხვა — admin თუ user (user-ის დამატებული კითხვა isActive:false იქმნება)
  @Column({ type: 'enum', enum: CreatorType, default: CreatorType.ADMIN })
  creatorType!: CreatorType;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'createdById' })
  createdBy?: User;

  @Column({ nullable: true })
  createdById?: number;

  // მოწყობილობის/ბრაუზერის IP, საიდანაც კითხვა დაისვა — მრავალი პროფილით
  // ერთი დაივაისისგან დღეში 1-ზე მეტი კითხვის დამატების თავიდან ასაცილებლად
  @Column({ nullable: true })
  creatorIp?: string;

  // user-ის დასმული კითხვის განხილვის სტატუსი (admin-ის მიერ დამატებული კითხვები APPROVED-ია თავიდანვე)
  @Column({
    type: 'enum',
    enum: ApprovalStatus,
    default: ApprovalStatus.APPROVED,
  })
  approvalStatus!: ApprovalStatus;

  // უკუგდების მიზეზი, თუ admin-მა REJECTED-ად მონიშნა
  @Column({ type: 'text', nullable: true })
  rejectionReason?: string | null;

  // ვინ განიხილა (admin) და როდის
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reviewedById' })
  reviewedBy?: User;

  @Column({ nullable: true })
  reviewedById?: number;

  @Column({ type: 'timestamp', nullable: true })
  reviewedAt?: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  // admin-ის მიერ მთავარ გვერდზე დაპინული კითხვა (მნიშვნელოვნად მიჩნეული)
  @Column({ default: false })
  isPinned!: boolean;

  // როდის დაპინა admin-მა — რამდენიმე დაპინულის შემთხვევაში ამის მიხედვით ლაგდება (ბოლოს დაპინული ზემოთ)
  @Column({ type: 'timestamp', nullable: true })
  pinnedAt?: Date | null;
}
