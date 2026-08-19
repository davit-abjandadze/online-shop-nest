import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Answer } from './entities/answer.entity';
import { CreateAnswerDto } from './dto/create-answer.dto';
import { UpdateAnswerDto } from './dto/update-answer.dto';
import { ReorderAnswersDto } from './dto/reorder-answers.dto';
import { Question } from '../question/entities/question.entity';

@Injectable()
export class AnswerService {
  constructor(
    @InjectRepository(Answer)
    private answerRepository: Repository<Answer>,
    @InjectRepository(Question)
    private questionRepository: Repository<Question>,
  ) {}

  // ახალი პასუხის დამატება არსებულ კითხვაზე
  async addAnswerToQuestion(
    questionId: number,
    createAnswerDto: CreateAnswerDto,
  ) {
    // 1. ვიპოვოთ კითხვა
    const question = await this.questionRepository.findOne({
      where: { id: questionId },
    });
    if (!question) {
      throw new NotFoundException(`Question with ID ${questionId} not found`);
    }

    // 2. ახალი პასუხი ბოლოში ემატება — order = ამჟამინდელი მაქსიმუმ order + 1
    const raw = await this.answerRepository
      .createQueryBuilder('answer')
      .select('MAX(answer.order)', 'maxOrder')
      .where('answer.questionId = :questionId', { questionId })
      .getRawOne<{ maxOrder: number | null }>();
    const maxOrder = raw?.maxOrder ?? null;

    const answer = this.answerRepository.create({
      ...createAnswerDto,
      question,
      order: maxOrder === null || maxOrder === undefined ? 0 : +maxOrder + 1,
    });

    return this.answerRepository.save(answer);
  }

  // კითხვის პასუხების თანმიმდევრობის ცვლილება (დრაგ-ენდ-დროპისთვის) —
  // frontend-იდან მოდის სასურველი მიმდევრობით დალაგებული answer id-ების მასივი
  async reorderAnswers(questionId: number, reorderDto: ReorderAnswersDto) {
    const question = await this.questionRepository.findOne({
      where: { id: questionId },
      relations: { answers: true },
    });
    if (!question) {
      throw new NotFoundException(`Question with ID ${questionId} not found`);
    }

    const existingIds = question.answers.map((a) => a.id);
    const { answerIds } = reorderDto;

    const sameSet =
      answerIds.length === existingIds.length &&
      existingIds.every((id) => answerIds.includes(id));

    if (!sameSet) {
      throw new BadRequestException(
        'answerIds უნდა შეიცავდეს ამ კითხვის ყველა პასუხის ID-ს, ზუსტად ერთხელ თითოეული',
      );
    }

    const updatedAnswers = question.answers.map((answer) => ({
      ...answer,
      order: answerIds.indexOf(answer.id),
    }));

    return this.answerRepository.save(updatedAnswers);
  }

  // პასუხის განახლება
  async updateAnswer(id: number, updateAnswerDto: UpdateAnswerDto) {
    const answer = await this.answerRepository.preload({
      id,
      ...updateAnswerDto,
    });
    if (!answer) {
      throw new NotFoundException(`Answer with ID ${id} not found`);
    }
    return this.answerRepository.save(answer);
  }

  // პასუხის წაშლა
  async removeAnswer(id: number) {
    const answer = await this.answerRepository.findOne({ where: { id } });
    if (!answer) {
      throw new NotFoundException(`Answer with ID ${id} not found`);
    }
    return this.answerRepository.remove(answer);
  }
}
