import { ApiProperty } from '@nestjs/swagger';
import { UserRole, Gender } from '../../users/entities/user.entity';

class TokenUserDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'test@test.com' })
  email: string;

  @ApiProperty({ example: 'გიორგი' })
  firstName: string;

  @ApiProperty({ example: 'ბერიძე' })
  lastName: string;

  @ApiProperty({ enum: UserRole, example: UserRole.USER })
  role: UserRole;

  @ApiProperty({ enum: Gender, required: false })
  gender?: Gender;

  @ApiProperty({ example: 25, required: false })
  age?: number;

  // ნიღბულია (AuthService.generateToken()) — ბოლო 2 ციფრი ჩანს, დანარჩენი დაფარულია
  @ApiProperty({ example: '*********90', required: false })
  personalNumber?: string;

  // ნიღბულია (AuthService.generateToken()) — ბოლო 4 ციფრი ჩანს, დანარჩენი დაფარულია
  @ApiProperty({ example: '*********3456' })
  phoneNumber: string;

  @ApiProperty({ example: false })
  isEmailVerified: boolean;

  @ApiProperty({ example: true })
  isPhoneVerified: boolean;
}

// ეს DTO ზუსტად აღწერს AuthService.generateToken()-ის დაბრუნებულ სტრუქტურას —
// AuthController.login()/googleLogin() ამ ობიექტს პირდაპირ (envelope-ის გარეშე) აბრუნებს
export class LoginResponseDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  access_token: string;

  @ApiProperty({ type: TokenUserDto })
  user: TokenUserDto;
}
