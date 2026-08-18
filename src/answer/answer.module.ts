import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Answer } from './entities/answer.entity';
import { Question } from '../question/entities/question.entity';
import { AnswerService } from './answer.service';
import { AnswerController } from './answer.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Answer, Question])],
  controllers: [AnswerController],
  providers: [AnswerService],
  exports: [AnswerService],
})
export class AnswerModule {}
