import { 
  Entity, PrimaryGeneratedColumn, ManyToOne, 
  CreateDateColumn, Unique 
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Question } from '../../question/entities/question.entity';
import { Answer } from '../../answer/entities/answer.entity';

@Entity()
@Unique(['user', 'question'])
export class UserAnswer {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

  @ManyToOne(() => Question, { onDelete: 'CASCADE' })
  question: Question;

  @ManyToOne(() => Answer, { onDelete: 'CASCADE' })
  answer: Answer;

  @CreateDateColumn()
  createdAt: Date;
}