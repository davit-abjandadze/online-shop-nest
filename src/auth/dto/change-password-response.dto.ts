import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordResponseDto {
  @ApiProperty({ example: 200 })
  statusCode: number;

  @ApiProperty({ example: 'პაროლი წარმატებით შეიცვალა' })
  message: string;

  // ⚠️ 2026-09-04: პაროლის შეცვლა ახლა აბათილებს ცვლილებამდე გაცემულ ყველა
  // ტოკენს (User.passwordChangedAt + JwtStrategy.validate), ანუ კლიენტის ხელში
  // არსებული access_token ამ მოთხოვნის შემდეგ მაშინვე 401-ს იღებდა. ამიტომ
  // იმავე პასუხში ახალ, ვალიდურ ტოკენს ვაბრუნებთ — ფრონტმა უბრალოდ უნდა
  // ჩაანაცვლოს შენახული ტოკენი და სესია არ წყდება.
  @ApiProperty({
    description: 'ახალი access token — ძველი ამ მოთხოვნის შემდეგ ბათილია',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  access_token: string;
}
