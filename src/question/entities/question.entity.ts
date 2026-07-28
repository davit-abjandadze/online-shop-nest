import { 
  Entity, 
  Column, 
  PrimaryGeneratedColumn, 
  OneToMany, 
  CreateDateColumn, 
  JoinColumn,
  ManyToOne // ← ეს აუცილებლად უნდა დაამატო!
} from 'typeorm';
import { Answer } from '../../answer/entities/answer.entity';
// რეკომენდებულია ფარდობითი გზა (relative path):
import { Category } from '../../category/entities/category.entity'; 

// კითხვის ტიპები
export enum QuestionType {
  SINGLE = 'single',     // ერთი პასუხის არჩევა (radio button)
  MULTIPLE = 'multiple', // რამდენიმე პასუხის მონიშვნა (checkbox)
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

  // ← ახალი ველები კატეგორიისთვის
  @ManyToOne(() => Category, (category) => category.questions, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'categoryId' })
  category?: Category;

  @Column({ nullable: true })
  categoryId?: number;

  @Column({ default: true })
  isActive!: boolean;

  @Column({ type: 'timestamp', nullable: true })
  endDate?: Date | null;

  @CreateDateColumn()
  createdAt!: Date;
}