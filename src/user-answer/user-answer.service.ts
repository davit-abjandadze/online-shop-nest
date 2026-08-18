import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException, // ← ახალი იმპორტი
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { UserAnswer } from './entities/user-answer.entity';
import { Question, QuestionType } from '../question/entities/question.entity';
import { Answer } from '../answer/entities/answer.entity';
import { User } from '../users/entities/user.entity';
import { SubmitAnswerDto } from './dto/submit-answer.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';

@Injectable()
export class UserAnswerService {
  constructor(
    @InjectRepository(UserAnswer)
    private userAnswerRepository: Repository<UserAnswer>,
    @InjectRepository(Question)
    private questionRepository: Repository<Question>,
    @InjectRepository(Answer)
    private answerRepository: Repository<Answer>,
  ) {}

  async submitAnswer(
    userId: number,
    questionId: number,
    submitDto: SubmitAnswerDto,
    ipAddress: string, // ← ახალი პარამეტრი
  ) {
    // 1. ვიპოვოთ კითხვა და მისი პასუხები
    const question = await this.questionRepository.findOne({
      where: { id: questionId },
      relations: { answers: true },
    });
    if (!question) {
      throw new NotFoundException('კითხვა ვერ მოიძებნა');
    }

    // ⭐ დეაქტივირებულ ან ვადაგასულ კითხვაზე ხმის მიცემა აკრძალულია
    const isExpired =
      !!question.endDate && new Date(question.endDate) <= new Date();
    if (!question.isActive || isExpired) {
      throw new BadRequestException(
        'კითხვა დეაქტივირებულია ან ვადაგასულია, ხმის მიცემა შეუძლებელია',
      );
    }

    // 2. SINGLE choice-ის შემთხვევაში, მხოლოდ 1 პასუხი შეიძლება
    if (
      question.type === QuestionType.SINGLE &&
      submitDto.answerIds.length > 1
    ) {
      throw new BadRequestException(
        'ეს კითხვა მხოლოდ ერთ პასუხს ითვალისწინებს',
      );
    }

    // datooo
    // ⭐ 3. ახალი: შევამოწმოთ, ხომ არ აქვს ამ IP-ს უკვე მიცემული ხმა ამ კითხვაზე
    const existingIpVote = await this.userAnswerRepository.findOne({
      where: {
        question: { id: questionId },
        ipAddress: ipAddress,
      },
    });

    if (existingIpVote) {
      throw new ConflictException(
        'ამ IP მისამართიდან უკვე მიცემულია ხმა ამ კითხვაზე. ერთი მომხმარებელი = ერთი ხმა.',
      );
    }

    // ⭐ 4. შევამოწმოთ, ხომ არ მიუცია უკვე მომხმარებელს ხმა ამ კითხვაზე
    const existingUserVote = await this.userAnswerRepository.findOne({
      where: {
        user: { id: userId },
        question: { id: questionId },
      },
    });

    if (existingUserVote) {
      throw new ConflictException(
        'თქვენ უკვე მიეცით ხმა ამ კითხვაზე. ხელახლა ხმის მიცემა შეუძლებელია.',
      );
    }

    // 5. შევამოწმოთ, რომ ყველა answerId ამ კითხვას ეკუთვნის
    const validAnswerIds = question.answers.map((a) => a.id);
    for (const answerId of submitDto.answerIds) {
      if (!validAnswerIds.includes(answerId)) {
        throw new BadRequestException(
          `პასუხი ${answerId} არ ეკუთვნის ამ კითხვას`,
        );
      }
    }

    // 6. შევქმნათ და შევინახოთ ჩანაწერები
    const userAnswers: UserAnswer[] = [];
    for (const answerId of submitDto.answerIds) {
      const userAnswer = this.userAnswerRepository.create({
        user: { id: userId },
        question: { id: questionId },
        answer: { id: answerId },
        ipAddress: ipAddress, // ⭐ ვინახავთ IP-ს ბაზაში
      });
      const saved = await this.userAnswerRepository.save(userAnswer);
      userAnswers.push(saved);
    }

    return userAnswers;
  }

  // კითხვის შედეგების ნახვა (უცვლელია)
  async getQuestionResults(questionId: number) {
    const question = await this.questionRepository.findOne({
      where: { id: questionId },
      relations: { answers: true },
    });
    if (!question) {
      throw new NotFoundException('Question not found');
    }

    const totalVotes = await this.userAnswerRepository.count({
      where: { question: { id: questionId } },
    });

    const results = await Promise.all(
      question.answers.map(async (answer) => {
        const votes = await this.userAnswerRepository.count({
          where: { answer: { id: answer.id } },
        });
        const percentage =
          totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
        return {
          answerId: answer.id,
          answerText: answer.text,
          votes,
          percentage,
        };
      }),
    );

    return {
      question: question.text,
      type: question.type,
      totalVotes,
      results,
    };
  }

  // ხმა მიცემული კითხვების მიღება (უცვლელია)
  async getVotedQuestionIds(userId: number): Promise<number[]> {
    const userAnswers = await this.userAnswerRepository.find({
      where: { user: { id: userId } },
      relations: { question: true },
    });
    const uniqueQuestionIds = [
      ...new Set(userAnswers.map((ua) => ua.question.id)),
    ];
    return uniqueQuestionIds;
  }

  // ⭐ პროფილის "აქტივობები" - ხმა მიცემული კითხვები, pagination და ფილტრით (კატეგორია/სტატუსი)
  async getMyActivities(
    userId: number,
    paginationDto: PaginationDto = {},
    categoryId?: number,
    status?: 'active' | 'inactive',
  ): Promise<
    PaginatedResponseDto<{
      question: Question;
      myAnswers: Answer[];
      votedAt: Date;
    }>
  > {
    const { page = 1, limit = 10, order = 'DESC' } = paginationDto;

    // 1. კითხვის ID-ები, რომლებზეც userId-მა მისცა ხმა (+ ბოლო ხმის მიცემის თარიღი)
    const votesQuery = this.userAnswerRepository
      .createQueryBuilder('ua')
      .select('question.id', 'questionId')
      .addSelect('MAX(ua.createdAt)', 'votedAt')
      .innerJoin('ua.user', 'user')
      .innerJoin('ua.question', 'question')
      .where('user.id = :userId', { userId })
      .groupBy('question.id');

    if (categoryId) {
      votesQuery.andWhere(
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

    const now = new Date();
    if (status === 'active') {
      votesQuery
        .andWhere('question.isActive = :isActive', { isActive: true })
        .andWhere('(question.endDate IS NULL OR question.endDate > :now)', {
          now,
        });
    } else if (status === 'inactive') {
      votesQuery.andWhere(
        '(question.isActive = :isActive OR (question.endDate IS NOT NULL AND question.endDate <= :now))',
        { isActive: false, now },
      );
    }

    const allVotes = await votesQuery.getRawMany<{
      questionId: string;
      votedAt: Date;
    }>();
    const total = allVotes.length;

    if (total === 0) {
      return new PaginatedResponseDto([], total, page, limit);
    }

    const sorted = [...allVotes].sort((a, b) =>
      order === 'ASC'
        ? new Date(a.votedAt).getTime() - new Date(b.votedAt).getTime()
        : new Date(b.votedAt).getTime() - new Date(a.votedAt).getTime(),
    );
    const pageVotes = sorted.slice(
      (page - 1) * limit,
      (page - 1) * limit + limit,
    );
    const questionIds = pageVotes.map((v) => Number(v.questionId));

    // 2. სრული კითხვები (პასუხების ვარიანტებით და კატეგორიით)
    const questions = await this.questionRepository.find({
      where: { id: In(questionIds) },
      relations: { answers: true, categories: true },
    });
    const questionById = new Map(questions.map((q) => [q.id, q]));

    // 3. userId-ის მიერ ამ კითხვებზე არჩეული პასუხები
    const myAnswers = await this.userAnswerRepository.find({
      where: { user: { id: userId }, question: { id: In(questionIds) } },
      relations: { answer: true, question: true },
    });
    const answersByQuestionId = new Map<number, Answer[]>();
    for (const ua of myAnswers) {
      const qId = ua.question.id;
      if (!answersByQuestionId.has(qId)) {
        answersByQuestionId.set(qId, []);
      }
      answersByQuestionId.get(qId)!.push(ua.answer);
    }

    const data = pageVotes
      .map((v) => {
        const qId = Number(v.questionId);
        const question = questionById.get(qId);
        if (!question) {
          return null;
        }
        return {
          question,
          myAnswers: answersByQuestionId.get(qId) ?? [],
          votedAt: v.votedAt,
        };
      })
      .filter(
        (
          item,
        ): item is { question: Question; myAnswers: Answer[]; votedAt: Date } =>
          !!item,
      );

    return new PaginatedResponseDto(data, total, page, limit);
  }
}
