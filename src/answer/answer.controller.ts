import { Controller, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { AnswerService } from './answer.service';
import { CreateAnswerDto } from './dto/create-answer.dto';
import { UpdateAnswerDto } from './dto/update-answer.dto';

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
