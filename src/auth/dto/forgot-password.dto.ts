import { IsEmail, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { NormalizeEmail } from '../../common/decorators/normalize-email.decorator';

export class ForgotPasswordDto {
  @ApiProperty({
    example: 'dato@gmail.com',
    description: 'მომხმარებლის ელფოსტა',
  })
  @NormalizeEmail()
  @IsEmail({}, { message: 'ელფოსტა არასწორი ფორმატისაა' })
  @IsNotEmpty({ message: 'ელფოსტა სავალდებულოა' })
  email!: string;
}
