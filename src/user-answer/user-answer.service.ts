import { 
  Injectable, BadRequestException, NotFoundException 
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

  // ⭐ 3. შევამოწმოთ, ხომ არ მიუცია უკვე მომხმარებელს ხმა ამ კითხვაზე
  const existingVote = await this.userAnswerRepository.findOne({
    where: {
      user: { id: userId },
      question: { id: questionId },
    },
  });

  if (existingVote) {
    throw new BadRequestException('თქვენ უკვე მიეცით ხმა ამ კითხვაზე. ხელახლა ხმის მიცემა შეუძლებელია.');
  }

  // 4. შევამოწმოთ, რომ ყველა answerId ამ კითხვას ეკუთვნის
  const validAnswerIds = question.answers.map(a => a.id);
  for (const answerId of submitDto.answerIds) {
    if (!validAnswerIds.includes(answerId)) {
      throw new BadRequestException(`პასუხი ${answerId} არ ეკუთვნის ამ კითხვას`);
    }
  }

  // 5. შევქმნათ და შევინახოთ ჩანაწერები
  const userAnswers: UserAnswer[] = [];
  for (const answerId of submitDto.answerIds) {
    const userAnswer = this.userAnswerRepository.create({
      user: { id: userId } as any,
      question: { id: questionId } as any,
      answer: { id: answerId } as any,
    });
    const saved = await this.userAnswerRepository.save(userAnswer);
    userAnswers.push(saved);
  }

  return userAnswers;
}
  // კითხვის შედეგების ნახვა
async getQuestionResults(questionId: number) {
  const question = await this.questionRepository.findOne({
    where: { id: questionId },
    relations: { answers: true },
  });
  if (!question) {
    throw new NotFoundException('Question not found');
  }

  // ვითვლით ყველა ხმას ამ კითხვაზე
  const totalVotes = await this.userAnswerRepository.count({
    where: { question: { id: questionId } },
  });

  // ვითვლით ხმებს თითოეული პასუხისთვის
  const results = await Promise.all(
    question.answers.map(async (answer) => {
      const votes = await this.userAnswerRepository.count({
        where: { answer: { id: answer.id } },
      });
      
      // პროცენტის გამოთვლა (თუ ხმები არ არის, 0%)
      const percentage = totalVotes > 0 
        ? Math.round((votes / totalVotes) * 100) 
        : 0;

      return {
        answerId: answer.id,
        answerText: answer.text,
        votes,
        percentage, // ← ახალი ველი!
      };
    })
  );

  return {
    question: question.text,
    type: question.type,
    totalVotes, // ← ახალი ველი!
    results,
  };
}

async getVotedQuestionIds(userId: number): Promise<number[]> {
  const userAnswers = await this.userAnswerRepository.find({
    where: { user: { id: userId } },
    relations: { question: true },
  });

  // უნიკალური კითხვის ID-ები
  const uniqueQuestionIds = [...new Set(userAnswers.map(ua => ua.question.id))];
  return uniqueQuestionIds;
}
}