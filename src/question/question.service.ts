import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { In, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import {
  ApprovalStatus,
  CreatorType,
  Question,
} from './entities/question.entity';
import { Category } from '../category/entities/category.entity';
import { UserRole } from '../users/entities/user.entity';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { RejectQuestionDto } from './dto/reject-question.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';

// request.user-ის ფორმა (JwtStrategy.validate()-იდან)
export interface RequestUser {
  userId: number;
  email: string;
  role: UserRole;
}

// მთავარ გვერდზე ერთდროულად დაპინული კითხვების მაქსიმალური რაოდენობა
const MAX_PINNED_QUESTIONS = 5;

@Injectable()
export class QuestionService {
  private readonly logger = new Logger(QuestionService.name);

  constructor(
    @InjectRepository(Question)
    private questionRepository: Repository<Question>,
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
  ) {}

  // categoryIds-ის მიხედვით კატეგორია entity-ების წამოღება, ID-ების არსებობის შემოწმებით
  private async resolveCategories(
    categoryIds?: number[],
  ): Promise<Category[] | undefined> {
    if (!categoryIds) {
      return undefined;
    }
    if (categoryIds.length === 0) {
      return [];
    }

    const uniqueIds = [...new Set(categoryIds)];
    const categories = await this.categoryRepository.find({
      where: { id: In(uniqueIds) },
    });

    if (categories.length !== uniqueIds.length) {
      const foundIds = new Set(categories.map((c) => c.id));
      const missingIds = uniqueIds.filter((id) => !foundIds.has(id));
      throw new BadRequestException(
        `კატეგორია ID-ით ${missingIds.join(', ')} ვერ მოიძებნა`,
      );
    }

    return categories;
  }

  async create(
    createQuestionDto: CreateQuestionDto,
    currentUser: RequestUser,
    creatorIp?: string,
  ) {
    const categories = await this.resolveCategories(
      createQuestionDto.categoryIds,
    );

    const isAdmin = currentUser.role === UserRole.ADMIN;

    if (!isAdmin) {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      // datooo
      // 1. ჩვეულებრივ user-ს დღეში მხოლოდ 1 კითხვის დამატება შეუძლია (per-account)
      const questionsToday = await this.questionRepository.count({
        where: {
          createdById: currentUser.userId,
          createdAt: MoreThanOrEqual(startOfDay),
        },
      });

      if (questionsToday >= 1) {
        throw new ConflictException(
          'დღეში მხოლოდ 1 კითხვის დამატება შეგიძლიათ',
        );
      }

      // 2. იმავე დღეს იმავე მოწყობილობიდან (IP) სხვა პროფილითაც არ შეიძლება კითხვის დამატება,
      //    რომ 1 ადამიანმა რამდენიმე ანგარიშით ვერ გამოვლის ლიმიტს
      if (creatorIp && creatorIp !== 'unknown') {
        const questionsTodayFromDevice = await this.questionRepository.count({
          where: {
            creatorIp,
            createdAt: MoreThanOrEqual(startOfDay),
          },
        });

        if (questionsTodayFromDevice >= 1) {
          throw new ConflictException(
            'ამ მოწყობილობიდან დღეს უკვე დამატებულია კითხვა (სხვა პროფილით). დღეში მხოლოდ 1 კითხვის დამატება შესაძლებელია ერთი მოწყობილობიდან.',
          );
        }
      }
    }

    const questionData = { ...createQuestionDto };
    delete questionData.categoryIds;
    const question = this.questionRepository.create({
      ...questionData,
      categories,
      createdById: currentUser.userId,
      creatorIp,
      creatorType: isAdmin ? CreatorType.ADMIN : CreatorType.USER,
      // user-ის დამატებული კითხვა ყოველთვის დასადასტურებელია (isActive:false, PENDING),
      // client-ისგან გამოგზავნილი isActive მასზე გავლენას არ ახდენს
      isActive: isAdmin ? (createQuestionDto.isActive ?? true) : false,
      approvalStatus: isAdmin
        ? ApprovalStatus.APPROVED
        : ApprovalStatus.PENDING,
      // დამთავრების თარიღის მითითება მხოლოდ admin-ს შეუძლია შექმნისას;
      // user-ის კითხვისთვის admin ამას approve-ის დროს დაუწესებს
      endDate: isAdmin ? createQuestionDto.endDate : undefined,
    });
    return this.questionRepository.save(question);
  }

  // admin ადასტურებს user-ის დასმულ კითხვას — ხდება აქტიური და ჩანს ვიდრე ხმის მიცემისთვის.
  // ამავე დროს შესაძლებელია დამთავრების თარიღის დაწესება (მხოლოდ admin-ის ხელით)
  async approve(id: number, adminId: number, endDate?: string) {
    const question = await this.findOne(id);
    question.approvalStatus = ApprovalStatus.APPROVED;
    question.isActive = true;
    question.rejectionReason = null;
    if (endDate !== undefined) {
      question.endDate = endDate ? new Date(endDate) : null;
    }
    question.reviewedById = adminId;
    question.reviewedAt = new Date();
    return this.questionRepository.save(question);
  }

  // admin უკუაგდებს user-ის დასმულ კითხვას მიზეზის მითითებით
  async reject(id: number, adminId: number, rejectDto: RejectQuestionDto) {
    const question = await this.findOne(id);
    question.approvalStatus = ApprovalStatus.REJECTED;
    question.isActive = false;
    question.rejectionReason = rejectDto.reason;
    question.reviewedById = adminId;
    question.reviewedAt = new Date();
    return this.questionRepository.save(question);
  }

  // მიმდინარე მომხმარებლის მიერ დასმული კითხვების სია (პროფილის გვერდისთვის)
  async findMyQuestions(
    userId: number,
    paginationDto: PaginationDto = {},
  ): Promise<PaginatedResponseDto<Question>> {
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      order = 'DESC',
    } = paginationDto;

    const allowedSortFields = ['createdAt', 'text', 'id'];
    const actualSortBy = allowedSortFields.includes(sortBy)
      ? sortBy
      : 'createdAt';

    const query = this.questionRepository
      .createQueryBuilder('question')
      .leftJoinAndSelect('question.answers', 'answers')
      .leftJoinAndSelect('question.categories', 'categories')
      .where('question.createdById = :userId', { userId })
      .orderBy(`question.${actualSortBy}`, order)
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await query.getManyAndCount();

    return new PaginatedResponseDto(data, total, page, limit);
  }

  // ⭐ განახლებული findAll - pagination-ით და აქტიურობის სტატუსის ფილტრით
  async findAll(
    categoryId?: number,
    paginationDto: PaginationDto = {},
    status?: 'active' | 'inactive',
    approvalStatus?: ApprovalStatus,
    creatorType?: CreatorType,
  ): Promise<PaginatedResponseDto<Question>> {
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      order = 'DESC',
    } = paginationDto;

    // დასაშვები sort ველების სია (უსაფრთხოებისთვის)
    const allowedSortFields = ['createdAt', 'text', 'id'];
    const actualSortBy = allowedSortFields.includes(sortBy)
      ? sortBy
      : 'createdAt';

    const query = this.questionRepository
      .createQueryBuilder('question')
      .leftJoinAndSelect('question.answers', 'answers')
      .leftJoinAndSelect('question.categories', 'categories');

    if (categoryId) {
      // many-to-many ფილტრი: question.id-ები, რომლებსაც join table-ში (question_categories)
      // მითითებული კატეგორია აქვს მიბმული (subquery, რომ categories-ის leftJoinAndSelect არ დაზიანდეს)
      query.andWhere(
        (qb) =>
          `question.id IN ${qb
            .subQuery()
            .select('qc."questionId"')
            .from('question_categories', 'qc')
            .where('qc."categoryId" = :categoryId')
            .getQuery()}`,
        { categoryId },
      );
    }

    if (approvalStatus) {
      query.andWhere('question.approvalStatus = :approvalStatus', {
        approvalStatus,
      });
    }

    if (creatorType) {
      query.andWhere('question.creatorType = :creatorType', { creatorType });
    }

    const now = new Date();
    if (status === 'active') {
      query.andWhere('question.isActive = :isActive', { isActive: true });
      query.andWhere('(question.endDate IS NULL OR question.endDate > :now)', {
        now,
      });
    } else if (status === 'inactive') {
      query.andWhere(
        '(question.isActive = :isActive OR (question.endDate IS NOT NULL AND question.endDate <= :now))',
        { isActive: false, now },
      );
    }

    query
      // დაპინული კითხვები ყოველთვის ზემოთაა, მათ შორის — ბოლოს დაპინული ყველაზე პირველი
      .orderBy('question.isPinned', 'DESC')
      .addOrderBy('question.pinnedAt', 'DESC')
      .addOrderBy(`question.${actualSortBy}`, order)
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await query.getManyAndCount();

    return new PaginatedResponseDto(data, total, page, limit);
  }

  async findOne(id: number) {
    const question = await this.questionRepository.findOne({
      where: { id },
      relations: { answers: true, categories: true },
    });
    if (!question) {
      throw new NotFoundException(`Question with ID ${id} not found`);
    }
    return question;
  }

  async update(id: number, updateQuestionDto: UpdateQuestionDto) {
    const question = await this.findOne(id);
    const { categoryIds, ...questionData } = updateQuestionDto;
    Object.assign(question, questionData);
    if (categoryIds !== undefined) {
      question.categories = await this.resolveCategories(categoryIds);
    }
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

  // admin-ის მიერ კითხვის მთავარ გვერდზე დაპინვა (მნიშვნელოვნად მიჩნეული)
  async pin(id: number) {
    const question = await this.findOne(id);

    if (!question.isPinned) {
      const pinnedCount = await this.questionRepository.count({
        where: { isPinned: true },
      });
      if (pinnedCount >= MAX_PINNED_QUESTIONS) {
        throw new ConflictException(
          `ერთდროულად მაქსიმუმ ${MAX_PINNED_QUESTIONS} კითხვის დაპინვა შესაძლებელია. ჯერ გააუქმეთ ერთი დაპინული კითხვა.`,
        );
      }
    }

    question.isPinned = true;
    question.pinnedAt = new Date();
    return this.questionRepository.save(question);
  }

  // admin-ის მიერ დაპინვის გაუქმება
  async unpin(id: number) {
    const question = await this.findOne(id);
    question.isPinned = false;
    question.pinnedAt = null;
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

  // ⭐ კითხვები, რომლებიც 5 დღეში ადმინმა არ დაადასტურა (PENDING-ში დარჩა), ავტომატურად წაიშლება ბაზიდან (ყოველდღიურად)
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async removeUnapprovedQuestions() {
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

    const result = await this.questionRepository.delete({
      approvalStatus: ApprovalStatus.PENDING,
      createdAt: LessThanOrEqual(fiveDaysAgo),
    });

    if (result.affected) {
      this.logger.log(
        `5 დღეზე მეტი უპასუხოდ დარჩენილი (PENDING) კითხვები წაშლილია: ${result.affected}`,
      );
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
