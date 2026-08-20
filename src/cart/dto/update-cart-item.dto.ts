import { IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateCartItemDto {
  @ApiProperty({ description: 'ახალი რაოდენობა', example: 2, minimum: 1 })
  @Type(() => Number)
  @IsInt({ message: 'რაოდენობა უნდა იყოს მთელი რიცხვი' })
  @Min(1, { message: 'რაოდენობა უნდა იყოს მინიმუმ 1' })
  quantity!: number;
}
