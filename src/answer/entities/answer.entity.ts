import { Entity, Column, PrimaryGeneratedColumn, ManyToOne } from 'typeorm';
import { Question } from '../../question/entities/question.entity';

@Entity()
export class Answer {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  text!: string;

  // პასუხების თანმიმდევრობა კითხვის ფარგლებში (0-დან იწყება) — დრაგ-ენდ-დროპით იცვლება
  @Column({ default: 0 })
  order!: number;

  @ManyToOne(() => Question, (question) => question.answers, {
    onDelete: 'CASCADE',
  })
  question!: Question;
}
