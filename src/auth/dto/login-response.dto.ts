import { ApiProperty } from '@nestjs/swagger';

class UserDataDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'test@test.com' })
  email: string;

  @ApiProperty({ example: 'გიორგი' })
  firstName: string;

  @ApiProperty({ example: 'ბერიძე' })
  lastName: string;

  @ApiProperty({ example: 25, required: false })
  age?: number;

  @ApiProperty({ example: '01234567890', required: false })
  personalNumber?: string;

  @ApiProperty({ example: '+995555123456' })
  phoneNumber: string;
}

class TokenDataDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  access_token: string;

  @ApiProperty({ type: UserDataDto })
  user: UserDataDto;
}

export class LoginResponseDto {
  @ApiProperty({ example: 200 })
  statusCode: number;

  @ApiProperty({ example: 'წარმატებით შეხვედით სისტემაში' })
  message: string;

  @ApiProperty({ type: TokenDataDto })
  data: TokenDataDto;
}
