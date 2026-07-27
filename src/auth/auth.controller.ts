import { 
  Controller, 
  Post, 
  Body, 
  HttpCode, 
  HttpStatus, 
  Get,          // ← დაემატა
  UseGuards     // ← დაემატა
} from '@nestjs/common';
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiBearerAuth // ← დაემატა (Swagger-ში ტოკენის ველის საჩვენებლად)
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/create-login.dto';
import { RegisterResponseDto } from './dto/register-response.dto';
import { LoginResponseDto } from './dto/login-response.dto';

// ↓↓↓ ახალი იმპორტები როლების სისტემისთვის ↓↓↓
// შენი ფოლდერების სტრუქტურის მიხედვით შეცვალე გზები (paths) თუ საჭიროა
import { JwtAuthGuard } from './jwt-auth.guard'; 
import { RolesGuard } from '../common/guards/roles.guard'; 
import { Roles } from '../common/decorators/roles.decorator'; 
import { UserRole } from '../users/entities/user.entity'; 
import { ChangePasswordResponseDto } from './dto/change-password-response.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'მომხმარებლის რეგისტრაცია' })
  @ApiResponse({ status: 201, description: 'წარმატებული რეგისტრაცია', type: RegisterResponseDto })
  @ApiResponse({ status: 409, description: 'ელფოსტა უკვე დაკავებულია' })
  @ApiResponse({ status: 400, description: 'ვალიდაციის შეცდომა' })
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'მომხმარებლის ავტორიზაცია' })
  @ApiResponse({ status: 200, description: 'წარმატებული ავტორიზაცია', type: LoginResponseDto })
  @ApiResponse({ status: 401, description: 'არასწორი ელფოსტა ან პაროლი' })
  @ApiResponse({ status: 400, description: 'ვალიდაციის შეცდომა' })
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  // ============================================================
  // ახალი მაგალითები ქვემოთ:
  // ============================================================

  // 1. მხოლოდ ავტორიზებული მომხმარებლისთვის (ნებისმიერი როლი)
  @Get('profile')
  @UseGuards(JwtAuthGuard) // მხოლოდ JwtAuthGuard საკმარისია
  @ApiBearerAuth()
  @ApiOperation({ summary: 'მიმდინარე მომხმარებლის პროფილი' })
  @ApiResponse({ status: 200, description: 'წარმატებული წვდომა' })
  @ApiResponse({ status: 401, description: 'არ ხართ ავტორიზებული' })
  getProfile() {
    return { message: 'ეს ინფორმაცია მხოლოდ ავტორიზებულებს შეუძლიათ ნახონ' };
  }

  // 2. მხოლოდ ადმინისტრატორისთვის (ADMIN)
  @Get('dashboard')
  @UseGuards(JwtAuthGuard, RolesGuard) // ჯერ ვამოწმებთ ტოკენს, მერე როლს!
  @Roles(UserRole.ADMIN) // ← ეს დეკორატორი კრძალავს ჩვეულებრივ USER-ებს
  @ApiBearerAuth()
  @ApiOperation({ summary: 'მხოლოდ ადმინისტრატორის პანელი' })
  @ApiResponse({ status: 200, description: 'წარმატებული წვდომა' })
  @ApiResponse({ status: 403, description: 'არ გაქვს ადმინისტრატორის უფლებები' })
  @ApiResponse({ status: 401, description: 'არ ხართ ავტორიზებული' })
  getAdminDashboard() {
    return { message: 'მოგესალმებით, ადმინისტრატორო! ეს მხოლოდ შენთვისაა.' };
  }

  // ← ახალი endpoint: პაროლის შეცვლა
  @Post('change-password')
  @UseGuards(JwtAuthGuard) // მხოლოდ ავტორიზებულებს შეუძლიათ!
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'პაროლის შეცვლა (ავტორიზებული მომხმარებლისთვის)' })
  @ApiResponse({ 
    status: 200, 
    description: 'პაროლი წარმატებით შეიცვალა',
    type: ChangePasswordResponseDto,
  })
  @ApiResponse({ 
    status: 400, 
    description: 'ძველი პაროლი არასწორია ან ახალი პაროლი ძველს ემთხვევა' 
  })
  @ApiResponse({ 
    status: 401, 
    description: 'არ ხართ ავტორიზებული' 
  })
  changePassword(
    @CurrentUser() user: any,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(user.userId, changePasswordDto);
  }
  @Post('google')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Google-ით ავტორიზაცია/რეგისტრაცია' })
  @ApiResponse({ status: 200, description: 'წარმატებული ავტორიზაცია', type: LoginResponseDto })
  async googleLogin(@Body() body: { email: string; firstName: string; lastName: string }) {
    return this.authService.googleLogin(body);
  }

    @Post('facebook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Facebook-ით ავტორიზაცია/რეგისტრაცია' })
  @ApiResponse({ status: 200, description: 'წარმატებული ავტორიზაცია', type: LoginResponseDto })
  async facebookLogin(@Body() body: { email: string; firstName: string; lastName: string }) {
    return this.authService.facebookLogin(body);
  }

    @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'პაროლის აღდგენის მოთხოვნა (email-ის გაგზავნა)' })
  @ApiResponse({ status: 200, description: 'ინსტრუქცია გაიგზავნა' })
  @ApiResponse({ status: 400, description: 'არასწორი ელფოსტა' })
  forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'პაროლის აღდგენა token-ით' })
  @ApiResponse({ status: 200, description: 'პაროლი წარმატებით შეიცვალა' })
  @ApiResponse({ status: 400, description: 'არასწორი ან ამოწურული token' })
  resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetPasswordDto);
  }
}