import { 
  Entity, Column, PrimaryGeneratedColumn, 
  OneToMany, CreateDateColumn 
} from 'typeorm';
import { Answer } from '../../answer/entities/answer.entity';

// კითხვის ტიპები
export enum QuestionType {
  SINGLE = 'single',     // ერთი პასუხის არჩევა (radio button)
  MULTIPLE = 'multiple', // რამდენიმე პასუხის მონიშვნა (checkbox)
}

@Entity()
export class Question {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  text: string;

  @Column({
    type: 'enum',
    enum: QuestionType,
    default: QuestionType.SINGLE, // ნაგულისხმევად ერთი პასუხი
  })
  type: QuestionType;

  @OneToMany(() => Answer, (answer) => answer.question, {
    cascade: true,
  })
  answers: Answer[];

  @CreateDateColumn()
  createdAt: Date;
}