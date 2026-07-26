import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Question } from './entities/question.entity';
import { Category } from '../category/entities/category.entity'; // ← 1. დაამატე ეს იმპორტი
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';

@Injectable()
export class QuestionService {
  // ← 2. წაშალე [x: string]: any; ეს მალავს შეცდომებს!

  constructor(
    @InjectRepository(Question)
    private questionRepository: Repository<Question>,
    
    // ← 3. დაამატე CategoryRepository კონსტრუქტორში!
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
  ) {}

  async create(createQuestionDto: CreateQuestionDto) {
    // თუ categoryId მოწოდებულია, შევამოწმოთ რომ კატეგორია არსებობს
    if (createQuestionDto.categoryId) {
      const categoryExists = await this.categoryRepository.findOne({
        where: { id: createQuestionDto.categoryId }
      });
      
      if (!categoryExists) {
        throw new BadRequestException(`კატეგორია ID-ით ${createQuestionDto.categoryId} ვერ მოიძებნა`);
      }
    }

    const question = this.questionRepository.create(createQuestionDto);
    return this.questionRepository.save(question);
  }

  async findAll(categoryId?: number) {
    const where: any = {};
    if (categoryId) {
      where.categoryId = categoryId;
    }

    return this.questionRepository.find({
      where,
      relations: { answers: true, category: true },
    });
  }

  async findOne(id: number) {
    const question = await this.questionRepository.findOne({
      where: { id },
      relations: { answers: true, category: true }, // category-იც დავამატე, რომ პასუხშიც გამოჩნდეს
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