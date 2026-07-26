import { 
  Entity, 
  PrimaryGeneratedColumn, 
  ManyToOne, 
  CreateDateColumn 
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Question } from '../../question/entities/question.entity';
import { Answer } from '../../answer/entities/answer.entity';

@Entity()
export class UserAnswer {
  @PrimaryGeneratedColumn()
  id!: number; // ← დაამატე '!'

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user!: User; // ← დაამატე '!'

  @ManyToOne(() => Question, { onDelete: 'CASCADE' })
  question!: Question; // ← დაამატე '!'

  @ManyToOne(() => Answer, { onDelete: 'CASCADE' })
  answer!: Answer; // ← დაამატე '!'

  @CreateDateColumn()
  createdAt!: Date; // ← დაამატე '!'
}