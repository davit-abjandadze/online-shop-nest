import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserAnswer } from './entities/user-answer.entity';
import { UserAnswerService } from './user-answer.service';
import { UserAnswerController } from './user-answer.controller';
import { Question } from '../question/entities/question.entity';
import { Answer } from '../answer/entities/answer.entity';

@Module({
  imports: [TypeOrmModule.forFeature([UserAnswer, Question, Answer])],
  controllers: [UserAnswerController],
  providers: [UserAnswerService],
})
export class UserAnswerModule {}