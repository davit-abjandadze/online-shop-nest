import {
  Controller,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AnswerService } from './answer.service';
import { CreateAnswerDto } from './dto/create-answer.dto';
import { UpdateAnswerDto } from './dto/update-answer.dto';
import { ReorderAnswersDto } from './dto/reorder-answers.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

@Controller()
export class AnswerController {
  constructor(private readonly answerService: AnswerService) {}

  // POST /questions/1/answers - ახალი პასუხის დამატება კითხვაზე
  @Post('questions/:questionId/answers')
  addAnswer(
    @Param('questionId') questionId: string,
    @Body() createAnswerDto: CreateAnswerDto,
  ) {
    return this.answerService.addAnswerToQuestion(+questionId, createAnswerDto);
  }

  // PATCH /questions/1/answers/reorder - პასუხების თანმიმდევრობის ცვლილება
  // (დრაგ-ენდ-დროპისთვის, მხოლოდ admin)
  @Patch('questions/:questionId/answers/reorder')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'კითხვის პასუხების თანმიმდევრობის ცვლილება დრაგ-ენდ-დროპით (მხოლოდ admin)',
  })
  reorder(
    @Param('questionId') questionId: string,
    @Body() reorderDto: ReorderAnswersDto,
  ) {
    return this.answerService.reorderAnswers(+questionId, reorderDto);
  }

  // PATCH /answers/1 - პასუხის განახლება
  @Patch('answers/:id')
  update(@Param('id') id: string, @Body() updateAnswerDto: UpdateAnswerDto) {
    return this.answerService.updateAnswer(+id, updateAnswerDto);
  }

  // DELETE /answers/1 - პასუხის წაშლა
  @Delete('answers/:id')
  remove(@Param('id') id: string) {
    return this.answerService.removeAnswer(+id);
  }
}
