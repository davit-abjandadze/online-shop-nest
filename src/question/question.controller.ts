import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import express from 'express'; // ← IP-ის ამოსაღებად (იგივე პატერნი, რაც UserAnswerController-ში)
import { QuestionService } from './question.service';
import type { RequestUser } from './question.service';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { RejectQuestionDto } from './dto/reject-question.dto';
import { ApiOperation, ApiTags, ApiQuery, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { FindQuestionsQueryDto } from './dto/find-questions-query.dto';
import { Question } from './entities/question.entity';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../users/entities/user.entity';

@ApiTags('questions')
@Controller('questions')
export class QuestionController {
  constructor(private readonly questionService: QuestionService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'კითხვის დამატება (user-ს დღეში 1-ხელ, ერთი მოწყობილობიდან; user-ის კითხვა isActive:false/PENDING იქმნება)' })
  @ApiResponse({ status: 409, description: 'user-მა (ან ამ მოწყობილობიდან სხვა პროფილმა) უკვე დასვა კითხვა დღეს' })
  create(
    @Req() req: express.Request,
    @CurrentUser() user: RequestUser,
    @Body() createQuestionDto: CreateQuestionDto,
  ) {
    // IP-ის სანდო ამოღება (მუშაობს როგორც ლოკალურად, ასევე პროდაქშენში)
    const forwarded = req.headers['x-forwarded-for'];
    const ip = forwarded
      ? (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : forwarded[0])
      : (req.ip || req.socket.remoteAddress || 'unknown');

    return this.questionService.create(createQuestionDto, user, ip);
  }

  @Get('my-questions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'ჩემ მიერ დასმული კითხვების სია (პროფილის გვერდისთვის, admin-ის დასტურის სტატუსით)' })
  findMyQuestions(@CurrentUser() user: RequestUser, @Query() query: PaginationDto) {
    return this.questionService.findMyQuestions(user.userId, query);
  }

  @Get()
  @ApiOperation({ summary: 'ყველა კითხვა (pagination, ფილტრით)' })
  @ApiQuery({ name: 'category', required: false, description: 'კატეგორიის ID' })
  @ApiQuery({ name: 'page', required: false, description: 'გვერდის ნომერი', example: 1 })
  @ApiQuery({ name: 'limit', required: false, description: 'ჩანაწერები გვერდზე', example: 10 })
  @ApiQuery({ name: 'sortBy', required: false, description: 'დალაგების ველი', example: 'createdAt' })
  @ApiQuery({ name: 'order', required: false, enum: ['ASC', 'DESC'], description: 'მიმართულება' })
  @ApiQuery({ name: 'status', required: false, enum: ['active', 'inactive'], description: 'აქტიურობის სტატუსი (ვადაგასული კითხვები ავტომატურად ითვლება inactive-ად)' })
  @ApiQuery({ name: 'approvalStatus', required: false, enum: ['pending', 'approved', 'rejected'], description: 'admin-ის განხილვის სტატუსი' })
  @ApiQuery({ name: 'creatorType', required: false, enum: ['admin', 'user'], description: 'ვინ დასვა კითხვა' })
  @ApiResponse({
    status: 200,
    description: 'კითხვების სია pagination-ით',
    type: PaginatedResponseDto<Question>,
  })
  findAll(@Query() query: FindQuestionsQueryDto) {
    return this.questionService.findAll(
      query.category,
      query,
      query.status,
      query.approvalStatus,
      query.creatorType,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.questionService.findOne(+id);
  }

  @Patch(':id/activate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'კითხვის გააქტიურება (მხოლოდ admin)' })
  activate(@Param('id') id: string) {
    return this.questionService.activate(+id);
  }

  @Patch(':id/deactivate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'კითხვის დეაქტივაცია (მხოლოდ admin)' })
  deactivate(@Param('id') id: string) {
    return this.questionService.deactivate(+id);
  }

  @Patch(':id/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'user-ის დასმული კითხვის დადასტურება (მხოლოდ admin)' })
  approve(@CurrentUser() admin: RequestUser, @Param('id') id: string) {
    return this.questionService.approve(+id, admin.userId);
  }

  @Patch(':id/reject')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'user-ის დასმული კითხვის უკუგდება მიზეზის მითითებით (მხოლოდ admin)' })
  reject(
    @CurrentUser() admin: RequestUser,
    @Param('id') id: string,
    @Body() rejectDto: RejectQuestionDto,
  ) {
    return this.questionService.reject(+id, admin.userId, rejectDto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'კითხვის რედაქტირება, მათ შორის user-ის დასმული კითხვის ტექსტის/პასუხების ცვლილება (მხოლოდ admin)' })
  update(@Param('id') id: string, @Body() updateQuestionDto: UpdateQuestionDto) {
    return this.questionService.update(+id, updateQuestionDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'კითხვის წაშლა (მხოლოდ admin)' })
  remove(@Param('id') id: string) {
    return this.questionService.remove(+id);
  }
}