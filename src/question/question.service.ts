import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Question } from './entities/question.entity';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';

@Injectable()
export class QuestionService {
  constructor(
    @InjectRepository(Question)
    private questionRepository: Repository<Question>,
  ) {}

  async create(createQuestionDto: CreateQuestionDto) {
    const question = this.questionRepository.create(createQuestionDto);
    return this.questionRepository.save(question);
  }

  async findAll() {
    return this.questionRepository.find({
      relations: { answers: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: number) {
    const question = await this.questionRepository.findOne({
      where: { id },
      relations: { answers: true },
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