import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Question } from './entities/question.entity';
import { Category } from '../category/entities/category.entity';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';

@Injectable()
export class QuestionService {
  constructor(
    @InjectRepository(Question)
    private questionRepository: Repository<Question>,
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
  ) {}

  async create(createQuestionDto: CreateQuestionDto) {
    if (createQuestionDto.categoryId) {
      const categoryExists = await this.categoryRepository.findOne({
        where: { id: createQuestionDto.categoryId },
      });
      if (!categoryExists) {
        throw new BadRequestException(`კატეგორია ID-ით ${createQuestionDto.categoryId} ვერ მოიძებნა`);
      }
    }
    const question = this.questionRepository.create(createQuestionDto);
    return this.questionRepository.save(question);
  }

  // ⭐ განახლებული findAll - pagination-ით
  async findAll(
    categoryId?: number,
    paginationDto: PaginationDto = {},
  ): Promise<PaginatedResponseDto<Question>> {
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      order = 'DESC',
    } = paginationDto;

    // დასაშვები sort ველების სია (უსაფრთხოებისთვის)
    const allowedSortFields = ['createdAt', 'text', 'id'];
    const actualSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';

    // WHERE პირობის აგება
    const where: any = {};
    if (categoryId) {
      where.categoryId = categoryId;
    }

    // TypeORM-ის findAndCount - ერთდროულად იღებს მონაცემებს და total count-ს
    const [data, total] = await this.questionRepository.findAndCount({
      where,
      relations: { answers: true, category: true },
      order: { [actualSortBy]: order },
      skip: (page - 1) * limit,
      take: limit,
    });

    return new PaginatedResponseDto(data, total, page, limit);
  }

  async findOne(id: number) {
    const question = await this.questionRepository.findOne({
      where: { id },
      relations: { answers: true, category: true },
    });
    if (!question) {
      throw new NotFoundException(`Question with ID ${id} not found`);
    }
    return question;
  }

  async update(id: number, updateQuestionDto: UpdateQuestionDto) {
    const question = await this.findOne(id);
    Object.assign(question, updateQuestionDto);
    return this.questionRepository.save(question);
  }

  async remove(id: number) {
    const question = await this.findOne(id);
    return this.questionRepository.remove(question);
  }
}