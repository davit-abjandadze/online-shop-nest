import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

// Facebook Login-ის მხრიდან მიღებული access token, რომელსაც ბექენდი თავად
// ვერიფიცირებს Graph API-ის debug_token endpoint-ით (იხ. AuthService.facebookLogin) —
// email/firstName/lastName კლიენტისგან აღარ მიიღება, რომ ვინმემ თვითნებურად ვერ
// „ჩაანაცვლოს" სხვისი ანგარიშის email.
export class FacebookLoginDto {
  @ApiProperty({
    description: 'Facebook Login-ის მიერ გაცემული access token',
  })
  @IsString()
  @IsNotEmpty()
  accessToken: string;
}
