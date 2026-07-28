import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { Question } from '../question/entities/question.entity';
import { UserAnswer } from '../user-answer/entities/user-answer.entity';
import { Category } from '../category/entities/category.entity';
import { StatsService } from './stats.service';
import { StatsController } from './stats.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User, Question, UserAnswer, Category])],
  controllers: [StatsController],
  providers: [StatsService],
})
export class StatsModule {}
