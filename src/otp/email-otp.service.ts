import { Injectable } from '@nestjs/common';
import { randomUUID, randomInt } from 'crypto';
import { EmailService } from '../common/email/email.service';

interface PendingEmailOtp {
  email: string;
  code: string;
  expiresAt: number;
  attempts: number;
}

// ელფოსტის OTP-ვერიფიკაცია (მაგ. პროფილში ელფოსტის შეცვლის წინ) — verify.ge-ს (OtpService)
// მსგავსი, მაგრამ საკუთარი, in-memory განხორციელება, რადგან ეს კოდი ელფოსტაზე იგზავნება
// EmailService-ის საშუალებით და მესამე მხარის SMS-პროვაიდერს არ სჭირდება.
//
// ⚠️ In-memory storage: მრავალინსტანციან (horizontally scaled) გარემოში საჭირო იქნება
// გაზიარებული საცავი (მაგ. Redis) — ერთი instance-ის restart-იც შლის მოლოდინში მყოფ კოდებს.
@Injectable()
export class EmailOtpService {
  private readonly pending = new Map<string, PendingEmailOtp>();
  private readonly TTL_MS = 10 * 60 * 1000; // 10 წუთი
  private readonly MAX_ATTEMPTS = 5;

  constructor(private readonly emailService: EmailService) {}

  async sendOtp(email: string): Promise<{ requestId: string }> {
    this.cleanupExpired();

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const requestId = randomUUID();

    this.pending.set(requestId, {
      email,
      code,
      expiresAt: Date.now() + this.TTL_MS,
      attempts: 0,
    });

    await this.emailService.sendOtpEmail(email, code);

    return { requestId };
  }

  // expectedEmail გადაცემისას დამატებით ვამოწმებთ, რომ requestId სწორედ ამ ელფოსტისთვის
  // გაგზავნილ კოდს შეესაბამება — ეს ხელს უშლის სხვა ელფოსტისთვის დადასტურებული
  // requestId-ის სხვა ელფოსტაზე გამოყენებას.
  verifyOtp(requestId: string, code: string, expectedEmail?: string): boolean {
    const entry = this.pending.get(requestId);
    if (!entry) return false;

    if (Date.now() > entry.expiresAt) {
      this.pending.delete(requestId);
      return false;
    }

    if (expectedEmail && entry.email !== expectedEmail) {
      return false;
    }

    entry.attempts += 1;
    if (entry.attempts > this.MAX_ATTEMPTS) {
      this.pending.delete(requestId);
      return false;
    }

    if (entry.code !== code) {
      return false;
    }

    // მიზანმიმართულად არ ვშლით requestId-ს წარმატებულ დადასტურებაზე: front-end ჯერ
    // POST /otp/verify-email-ით ხედავს "კოდი სწორია"-ს (რომ Save ღილაკი ჩართოს), შემდეგ
    // იმავე requestId+code-ს კვლავ უგზავნის საბოლოო PATCH /users/:id-ს, სადაც
    // UsersService.update ხელახლა ამოწმებს — ისევე, როგორც მობილურის OTP-ის რეგისტრაციის
    // ნაკადშია (AuthService.register). ვადა/ცდების ლიმიტი (TTL, MAX_ATTEMPTS) საკმარისია.
    return true;
  }

  private cleanupExpired() {
    const now = Date.now();
    for (const [requestId, entry] of this.pending) {
      if (now > entry.expiresAt) {
        this.pending.delete(requestId);
      }
    }
  }
}
