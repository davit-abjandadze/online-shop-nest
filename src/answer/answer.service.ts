import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Answer } from './entities/answer.entity';
import { CreateAnswerDto } from './dto/create-answer.dto';
import { UpdateAnswerDto } from './dto/update-answer.dto';
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
  async addAnswerToQuestion(questionId: number, createAnswerDto: CreateAnswerDto) {
    // 1. ვიპოვოთ კითხვა
    const question = await this.questionRepository.findOne({
      where: { id: questionId },
    });
    if (!question) {
      throw new NotFoundException(`Question with ID ${questionId} not found`);
    }

    // 2. შევქმნათ ახალი პასუხი
    const answer = this.answerRepository.create({
      ...createAnswerDto,
      question,
    });

    return this.answerRepository.save(answer);
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