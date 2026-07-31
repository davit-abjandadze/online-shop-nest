import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LessThanOrEqual, Repository } from 'typeorm';
import { Question } from './entities/question.entity';
import { Category } from '../category/entities/category.entity';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';

@Injectable()
export class QuestionService {
  private readonly logger = new Logger(QuestionService.name);

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

  // ⭐ განახლებული findAll - pagination-ით და აქტიურობის სტატუსის ფილტრით
  async findAll(
    categoryId?: number,
    paginationDto: PaginationDto = {},
    status?: 'active' | 'inactive',
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

    const query = this.questionRepository
      .createQueryBuilder('question')
      .leftJoinAndSelect('question.answers', 'answers')
      .leftJoinAndSelect('question.category', 'category');

    if (categoryId) {
      query.andWhere('question.categoryId = :categoryId', { categoryId });
    }

    const now = new Date();
    if (status === 'active') {
      query.andWhere('question.isActive = :isActive', { isActive: true });
      query.andWhere(
        '(question.endDate IS NULL OR question.endDate > :now)',
        { now },
      );
    } else if (status === 'inactive') {
      query.andWhere(
        '(question.isActive = :isActive OR (question.endDate IS NOT NULL AND question.endDate <= :now))',
        { isActive: false, now },
      );
    }

    query
      .orderBy(`question.${actualSortBy}`, order)
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await query.getManyAndCount();

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

  async activate(id: number) {
    const question = await this.findOne(id);
    question.isActive = true;
    return this.questionRepository.save(question);
  }

  async deactivate(id: number) {
    const question = await this.findOne(id);
    question.isActive = false;
    return this.questionRepository.save(question);
  }

  // ⭐ ვადაგასული კითხვების ავტომატური დეაქტივაცია (ყოველ წუთს)
  @Cron(CronExpression.EVERY_MINUTE)
  async deactivateExpiredQuestions() {
    const result = await this.questionRepository.update(
      {
        isActive: true,
        endDate: LessThanOrEqual(new Date()),
      },
      { isActive: false },
    );

    if (result.affected) {
      this.logger.log(`ვადაგასული კითხვები დეაქტივირდა: ${result.affected}`);
    }
  }

  // კითხვის რეალურ დროში აქტიურობის შემოწმება (ითვალისწინებს ვადის გასვლასაც)
  isQuestionActive(question: Question): boolean {
    if (!question.isActive) {
      return false;
    }
    if (question.endDate && new Date(question.endDate) <= new Date()) {
      return false;
    }
    return true;
  }
}