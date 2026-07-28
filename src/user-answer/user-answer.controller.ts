import { Controller, Post, Get, Param, Body, Query, UseGuards, Req, ConflictException } from '@nestjs/common';
import express from 'express'; // ← აუცილებელი იმპორტი IP-ის ამოსაღებად
import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserAnswerService } from './user-answer.service';
import { SubmitAnswerDto } from './dto/submit-answer.dto';
import { FindQuestionsQueryDto } from '../question/dto/find-questions-query.dto';

@Controller('user-answers')
export class UserAnswerController {
  constructor(private readonly userAnswerService: UserAnswerService) {}

  @Post('question/:questionId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'ხმის მიცემა კითხვაზე (IP ტრექინგით)' })
  @ApiResponse({ status: 201, description: 'ხმა წარმატებით დარეგისტრირდა' })
  @ApiResponse({ status: 409, description: 'ამ IP-დან ან მომხმარებლისგან უკვე მიცემულია ხმა' })
  submitAnswer(
    @Req() req: express.Request, // ← ვიღებთ მთლიან Request ობიექტს
    @CurrentUser() user: any,
    @Param('questionId') questionId: string,
    @Body() submitDto: SubmitAnswerDto,
  ) {
    // IP-ის სანდო ამოღება (მუშაობს როგორც ლოკალურად, ასევე პროდაქშენში)
    const forwarded = req.headers['x-forwarded-for'];
    const ip = forwarded 
      ? (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : forwarded[0])
      : (req.ip || req.socket.remoteAddress || 'unknown');

    console.log(`🔍 ხმის მიცემა: User ID: ${user.userId}, Question ID: ${questionId}, IP: ${ip}`);

    return this.userAnswerService.submitAnswer(
      user.userId,
      +questionId,
      submitDto,
      ip, // ← გადავცემთ IP-ს სერვისს
    );
  }

  @Get('question/:questionId/results')
  @ApiOperation({ summary: 'კითხვის შედეგების ნახვა' })
  getResults(@Param('questionId') questionId: string) {
    return this.userAnswerService.getQuestionResults(+questionId);
  }

  @Get('my-voted-questions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'კითხვების ID-ები, რომლებზეც მომხმარებელს აქვს ხმა მიცემული' })
  @ApiResponse({ status: 200, description: 'კითხვების ID-ების მასივი' })
  async getMyVotedQuestions(@CurrentUser() user: any) {
    return this.userAnswerService.getVotedQuestionIds(user.userId);
  }

  @Get('my-activities')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'პროფილის "აქტივობები" - ხმა მიცემული კითხვები (pagination, ფილტრით)' })
  @ApiResponse({ status: 200, description: 'ხმა მიცემული კითხვები pagination-ით' })
  getMyActivities(@CurrentUser() user: any, @Query() query: FindQuestionsQueryDto) {
    return this.userAnswerService.getMyActivities(user.userId, query, query.category, query.status);
  }
}