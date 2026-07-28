import { 
  Entity, 
  PrimaryGeneratedColumn, 
  ManyToOne, 
  CreateDateColumn, 
  Column
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Question } from '../../question/entities/question.entity';
import { Answer } from '../../answer/entities/answer.entity';

@Entity()
export class UserAnswer {
  @PrimaryGeneratedColumn()
  id!: number; // ← დაამატე '!'

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user?: User; // ← დაამატე '!'

  @ManyToOne(() => Question, { onDelete: 'CASCADE' })
  question!: Question; // ← დაამატე '!'

  @ManyToOne(() => Answer, { onDelete: 'CASCADE' })
  answer!: Answer; // ← დაამატე '!'

  // ⭐ ახალი ველი: IP მისამართის შესანახად
  @Column({ nullable: true })
  ipAddress?: string;

  @CreateDateColumn()
  createdAt!: Date; // ← დაამატე '!'
}