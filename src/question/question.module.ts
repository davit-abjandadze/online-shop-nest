import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Question } from './entities/question.entity';
import { Category } from '../category/entities/category.entity'; // ← ეს უნდა იყოს!
import { Answer } from '../answer/entities/answer.entity';
import { QuestionService } from './question.service';
import { QuestionController } from './question.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Question, Category, Answer]), // ← Category აქ უნდა იყოს!
  ],
  controllers: [QuestionController],
  providers: [QuestionService],
  exports: [QuestionService],
})
export class QuestionModule {}