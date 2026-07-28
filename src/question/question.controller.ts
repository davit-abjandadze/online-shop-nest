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
import { PaginationDto } from '../common/dto/pagination.dto';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
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
  @ApiResponse({
    status: 200,
    description: 'კითხვების სია pagination-ით',
    type: PaginatedResponseDto<Question>,
  })
  findAll(
    @Query('category') categoryId?: string,
    @Query() paginationDto?: PaginationDto,
  ) {
    return this.questionService.findAll(
      categoryId ? +categoryId : undefined,
      paginationDto,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.questionService.findOne(+id);
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