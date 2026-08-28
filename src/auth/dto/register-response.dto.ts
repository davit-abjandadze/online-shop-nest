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

export class RegisterResponseDto {
  @ApiProperty({ example: 201 })
  statusCode: number;

  @ApiProperty({ example: 'მომხმარებელი წარმატებით დარეგისტრირდა' })
  message: string;

  @ApiProperty({ type: TokenDataDto })
  data: TokenDataDto; // ← ახლა ემთხვევა generateToken()-ის სტრუქტურას
}
