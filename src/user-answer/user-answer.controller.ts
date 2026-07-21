import { Controller, Post, Get, Param, Body, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserAnswerService } from './user-answer.service';
import { SubmitAnswerDto } from './dto/submit-answer.dto';

@Controller('user-answers')
export class UserAnswerController {
  constructor(private readonly userAnswerService: UserAnswerService) {}

  @Post('question/:questionId')
  @UseGuards(JwtAuthGuard) // ← 1. ვაცუროთ endpoint (მხოლოდ ავტორიზებულებს შეუძლიათ)
  @ApiBearerAuth() // ← 2. Swagger-ს ვეუბნებით, რომ ამ endpoint-ს ტოკენი სჭირდება
  submitAnswer(
    @Param('questionId') questionId: string,
    @Body() submitDto: SubmitAnswerDto,
    @CurrentUser() user: any, // ← 3. ავტომატურად იღებს მომხმარებელს ტოკენიდან
  ) {
    console.log('🔍 USER OBJECT:', user); // ← ეს დაამატე!
    // user.userId არის ის ID, რაც JwtStrategy-ში დავაბრუნეთ
    return this.userAnswerService.submitAnswer(user.userId, +questionId, submitDto);
  }

  @Get('question/:questionId/results')
  getResults(@Param('questionId') questionId: string) {
    return this.userAnswerService.getQuestionResults(+questionId);
  }
}