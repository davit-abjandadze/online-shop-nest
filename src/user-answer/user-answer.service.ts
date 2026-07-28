import {
  Injectable, 
  BadRequestException, 
  NotFoundException, 
  ConflictException // ← ახალი იმპორტი
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserAnswer } from './entities/user-answer.entity';
import { Question, QuestionType } from '../question/entities/question.entity';
import { Answer } from '../answer/entities/answer.entity';
import { User } from '../users/entities/user.entity';
import { SubmitAnswerDto } from './dto/submit-answer.dto';

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

    // 2. SINGLE choice-ის შემთხვევაში, მხოლოდ 1 პასუხი შეიძლება
    if (question.type === QuestionType.SINGLE && submitDto.answerIds.length > 1) {
      throw new BadRequestException('ეს კითხვა მხოლოდ ერთ პასუხს ითვალისწინებს');
    }

    // ⭐ 3. ახალი: შევამოწმოთ, ხომ არ აქვს ამ IP-ს უკვე მიცემული ხმა ამ კითხვაზე
    const existingIpVote = await this.userAnswerRepository.findOne({
      where: {
        question: { id: questionId },
        ipAddress: ipAddress,
      },
    });

    if (existingIpVote) {
      throw new ConflictException('ამ IP მისამართიდან უკვე მიცემულია ხმა ამ კითხვაზე. ერთი მომხმარებელი = ერთი ხმა.');
    }

    // ⭐ 4. შევამოწმოთ, ხომ არ მიუცია უკვე მომხმარებელს ხმა ამ კითხვაზე
    const existingUserVote = await this.userAnswerRepository.findOne({
      where: {
        user: { id: userId },
        question: { id: questionId },
      },
    });

    if (existingUserVote) {
      throw new ConflictException('თქვენ უკვე მიეცით ხმა ამ კითხვაზე. ხელახლა ხმის მიცემა შეუძლებელია.');
    }

    // 5. შევამოწმოთ, რომ ყველა answerId ამ კითხვას ეკუთვნის
    const validAnswerIds = question.answers.map(a => a.id);
    for (const answerId of submitDto.answerIds) {
      if (!validAnswerIds.includes(answerId)) {
        throw new BadRequestException(`პასუხი ${answerId} არ ეკუთვნის ამ კითხვას`);
      }
    }

    // 6. შევქმნათ და შევინახოთ ჩანაწერები
    const userAnswers: UserAnswer[] = [];
    for (const answerId of submitDto.answerIds) {
      const userAnswer = this.userAnswerRepository.create({
        user: { id: userId } as any,
        question: { id: questionId } as any,
        answer: { id: answerId } as any,
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
        const percentage = totalVotes > 0 
          ? Math.round((votes / totalVotes) * 100) 
          : 0;
        return {
          answerId: answer.id,
          answerText: answer.text,
          votes,
          percentage,
        };
      })
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
    const uniqueQuestionIds = [...new Set(userAnswers.map(ua => ua.question.id))];
    return uniqueQuestionIds;
  }
}