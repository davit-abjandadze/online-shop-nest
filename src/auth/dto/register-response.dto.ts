import { LoginResponseDto } from './login-response.dto';

// AuthService.register() ბოლოს იმავე generateToken()-ს იძახებს, რასაც login() —
// ანუ დაბრუნებული სტრუქტურა იდენტურია LoginResponseDto-სი (envelope-ის გარეშე)
export class RegisterResponseDto extends LoginResponseDto {}
