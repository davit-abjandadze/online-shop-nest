import { IsEmail, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'dato@gmail.com', description: 'მომხმარებლის ელფოსტა' })
  @IsEmail({}, { message: 'ელფოსტა არასწორი ფორმატისაა' })
  @IsNotEmpty({ message: 'ელფოსტა სავალდებულოა' })
  email!: string;
}