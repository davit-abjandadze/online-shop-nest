import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Favorite } from './entities/favorite.entity';
import { Question } from '../question/entities/question.entity';
import { PaginationDto } from '../common/dto/pagination.dto';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';

@Injectable()
export class FavoriteService {
  constructor(
    @InjectRepository(Favorite)
    private favoriteRepository: Repository<Favorite>,
    @InjectRepository(Question)
    private questionRepository: Repository<Question>,
  ) {}

  async addFavorite(userId: number, questionId: number) {
    const question = await this.questionRepository.findOne({
      where: { id: questionId },
    });
    if (!question) {
      throw new NotFoundException(`კითხვა ID-ით ${questionId} ვერ მოიძებნა`);
    }

    const existing = await this.favoriteRepository.findOne({
      where: { user: { id: userId }, question: { id: questionId } },
    });
    if (existing) {
      throw new ConflictException('კითხვა უკვე ფავორიტებშია დამატებული');
    }

    const favorite = this.favoriteRepository.create({
      user: { id: userId } as any,
      question: { id: questionId } as any,
    });
    return this.favoriteRepository.save(favorite);
  }

  async removeFavorite(userId: number, questionId: number) {
    const favorite = await this.favoriteRepository.findOne({
      where: { user: { id: userId }, question: { id: questionId } },
    });
    if (!favorite) {
      throw new NotFoundException('ეს კითხვა ფავორიტებში ვერ მოიძებნა');
    }
    return this.favoriteRepository.remove(favorite);
  }

  async findMyFavorites(
    userId: number,
    paginationDto: PaginationDto = {},
  ): Promise<PaginatedResponseDto<Question>> {
    const { page = 1, limit = 10, order = 'DESC' } = paginationDto;

    const [favorites, total] = await this.favoriteRepository.findAndCount({
      where: { user: { id: userId } },
      relations: { question: { answers: true, categories: true } },
      order: { createdAt: order },
      skip: (page - 1) * limit,
      take: limit,
    });

    const data = favorites.map((f) => f.question);
    return new PaginatedResponseDto(data, total, page, limit);
  }
}
