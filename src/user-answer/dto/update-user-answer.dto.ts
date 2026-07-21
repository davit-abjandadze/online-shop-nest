import { PartialType } from '@nestjs/swagger';
import { CreateUserAnswerDto } from './create-user-answer.dto';

export class UpdateUserAnswerDto extends PartialType(CreateUserAnswerDto) {}
