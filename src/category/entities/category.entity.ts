import { Entity, PrimaryGeneratedColumn, Column, ManyToMany } from 'typeorm';
import { Question } from '../../question/entities/question.entity';

@Entity()
export class Category {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name!: string;

  @Column({ nullable: true })
  description?: string;

  @ManyToMany(() => Question, (question) => question.categories)
  questions?: Question[];
}