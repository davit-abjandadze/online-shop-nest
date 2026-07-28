import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { QuestionService } from './question.service';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { ApiOperation, ApiTags, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { FindQuestionsQueryDto } from './dto/find-questions-query.dto';
import { Question } from './entities/question.entity';

@ApiTags('questions')
@Controller('questions')
export class QuestionController {
  constructor(private readonly questionService: QuestionService) {}

  @Post()
  create(@Body() createQuestionDto: CreateQuestionDto) {
    return this.questionService.create(createQuestionDto);
  }

  @Get()
  @ApiOperation({ summary: 'ყველა კითხვა (pagination, ფილტრით)' })
  @ApiQuery({ name: 'category', required: false, description: 'კატეგორიის ID' })
  @ApiQuery({ name: 'page', required: false, description: 'გვერდის ნომერი', example: 1 })
  @ApiQuery({ name: 'limit', required: false, description: 'ჩანაწერები გვერდზე', example: 10 })
  @ApiQuery({ name: 'sortBy', required: false, description: 'დალაგების ველი', example: 'createdAt' })
  @ApiQuery({ name: 'order', required: false, enum: ['ASC', 'DESC'], description: 'მიმართულება' })
  @ApiQuery({ name: 'status', required: false, enum: ['active', 'inactive'], description: 'აქტიურობის სტატუსი (ვადაგასული კითხვები ავტომატურად ითვლება inactive-ად)' })
  @ApiResponse({
    status: 200,
    description: 'კითხვების სია pagination-ით',
    type: PaginatedResponseDto<Question>,
  })
  findAll(@Query() query: FindQuestionsQueryDto) {
    return this.questionService.findAll(query.category, query, query.status);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.questionService.findOne(+id);
  }

  @Patch(':id/activate')
  @ApiOperation({ summary: 'კითხვის გააქტიურება' })
  activate(@Param('id') id: string) {
    return this.questionService.activate(+id);
  }

  @Patch(':id/deactivate')
  @ApiOperation({ summary: 'კითხვის დეაქტივაცია' })
  deactivate(@Param('id') id: string) {
    return this.questionService.deactivate(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateQuestionDto: UpdateQuestionDto) {
    return this.questionService.update(+id, updateQuestionDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.questionService.remove(+id);
  }
}