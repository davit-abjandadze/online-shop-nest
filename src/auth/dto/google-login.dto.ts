import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

// Google-ის მხრიდან მიღებული ID Token (JWT), რომელსაც ბექენდი თავად ვერიფიცირებს
// Google-ის public key-ებით (იხ. AuthService.googleLogin) — email/firstName/lastName
// კლიენტისგან აღარ მიიღება, რომ ვინმემ თვითნებურად ვერ „ჩაანაცვლოს" სხვისი ანგარიშის email.
export class GoogleLoginDto {
  @ApiProperty({
    description: 'Google Identity Services-ის მიერ გაცემული ID Token (JWT)',
  })
  @IsString()
  @IsNotEmpty()
  idToken: string;
}
