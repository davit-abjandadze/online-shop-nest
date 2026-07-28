import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Favorite } from './entities/favorite.entity';
import { Question } from '../question/entities/question.entity';
import { FavoriteService } from './favorite.service';
import { FavoriteController } from './favorite.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Favorite, Question])],
  controllers: [FavoriteController],
  providers: [FavoriteService],
})
export class FavoriteModule {}
