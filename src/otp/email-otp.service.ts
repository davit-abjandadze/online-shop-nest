import { Injectable, BadRequestException } from '@nestjs/common';
import { randomUUID, randomInt } from 'crypto';
import { EmailService } from '../common/email/email.service';

interface PendingEmailOtp {
  email: string;
  code: string;
  expiresAt: number;
  attempts: number;
  // ერთხელ უკვე წარმატებით დადასტურდა? (იხ. verifyOtp-ის კომენტარი ორფაზიან
  // ნაკადზე) — ასეთ ჩანაწერზე იმავე სწორი კოდის ხელახალი შემოწმება ცდად აღარ
  // ითვლება, თორემ თავად "confirm" ფაზა ამოწურავდა MAX_ATTEMPTS-ს.
  verified: boolean;
}

interface EmailLock {
  attempts: number;
  blockedUntil: number;
  lastFailureAt: number;
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
  // ელფოსტაზე გაცემული ბოლო requestId — ახალი კოდის გაგზავნისას წინა requestId-ს
  // ვაბათილებთ, რომ ერთდროულად ერთზე მეტი ცოცხალი კოდი არ არსებობდეს ერთი
  // ელფოსტისთვის (წინააღმდეგ შემთხვევაში attacker-ს requestId-ების დამატება
  // per-requestId cap-ს (MAX_ATTEMPTS) გვერდს აუვლის).
  private readonly pendingRequestIdByEmail = new Map<string, string>();
  // MAX_ATTEMPTS ჯერადი ცდის ლიმიტს ვამოწმებთ ელფოსტის დონეზეც (და არა მხოლოდ
  // ცალკეული requestId-ის დონეზე) — ახალი კოდის მოთხოვნა ამ მთვლელს არ წმენდს,
  // ასე რომ requestId-ების დამატებითი გენერირება ვერ გვერდს უვლის brute-force ლიმიტს.
  private readonly emailLocks = new Map<string, EmailLock>();
  private readonly TTL_MS = 10 * 60 * 1000; // 10 წუთი
  private readonly MAX_ATTEMPTS = 5;
  private readonly LOCK_MS = 15 * 60 * 1000; // 15 წუთი დაბლოკვა ლიმიტის გადაჭარბებისას

  constructor(private readonly emailService: EmailService) {}

  async sendOtp(email: string): Promise<{ requestId: string }> {
    this.cleanupExpired();

    const lock = this.emailLocks.get(email);
    if (lock && Date.now() < lock.blockedUntil) {
      throw new BadRequestException(
        'ცდების ლიმიტი ამოწურულია — სცადეთ მოგვიანებით',
      );
    }

    // წინა, ჯერ კიდევ ცოცხალი requestId ამ ელფოსტისთვის ვაუქმებთ, რომ ერთდროულად
    // მხოლოდ ერთი აქტიური კოდი არსებობდეს — წინააღმდეგ შემთხვევაში ყოველი ახალი
    // sendOtp ცალკე MAX_ATTEMPTS-ს "ყიდულობდა".
    const previousRequestId = this.pendingRequestIdByEmail.get(email);
    if (previousRequestId) {
      this.pending.delete(previousRequestId);
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const requestId = randomUUID();

    this.pending.set(requestId, {
      email,
      code,
      expiresAt: Date.now() + this.TTL_MS,
      attempts: 0,
      verified: false,
    });
    this.pendingRequestIdByEmail.set(email, requestId);

    await this.emailService.sendOtpEmail(email, code);

    return { requestId };
  }

  // expectedEmail გადაცემისას დამატებით ვამოწმებთ, რომ requestId სწორედ ამ ელფოსტისთვის
  // გაგზავნილ კოდს შეესაბამება — ეს ხელს უშლის სხვა ელფოსტისთვის დადასტურებული
  // requestId-ის სხვა ელფოსტაზე გამოყენებას.
  verifyOtp(requestId: string, code: string, expectedEmail?: string): boolean {
    const entry = this.pending.get(requestId);
    if (!entry) return false;

    if (expectedEmail && entry.email !== expectedEmail) {
      return false;
    }

    const lock = this.emailLocks.get(entry.email);
    if (lock && Date.now() < lock.blockedUntil) {
      this.pending.delete(requestId);
      return false;
    }

    if (Date.now() > entry.expiresAt) {
      this.pending.delete(requestId);
      return false;
    }

    // უკვე დადასტურებული ჩანაწერზე იმავე სწორი კოდის ხელახალი შემოწმება
    // ორფაზიანი ნაკადის ნორმალური მეორე ბიჯია (იხ. ქვემოთ) — ცდად არ ვთვლით.
    // არასწორი კოდი ამ ეტაპზეც ჩვეულებრივად ისჯება (ქვევით ჩავარდება).
    if (entry.verified && entry.code === code) {
      return true;
    }

    entry.attempts += 1;
    if (entry.attempts > this.MAX_ATTEMPTS) {
      this.pending.delete(requestId);
      return false;
    }

    if (entry.code !== code) {
      this.registerFailure(entry.email);
      return false;
    }

    entry.verified = true;
    this.emailLocks.delete(entry.email);

    // მიზანმიმართულად არ ვშლით requestId-ს წარმატებულ დადასტურებაზე: front-end ჯერ
    // POST /otp/verify-email-ით ხედავს "კოდი სწორია"-ს (რომ Save ღილაკი ჩართოს), შემდეგ
    // იმავე requestId+code-ს კვლავ უგზავნის საბოლოო PATCH /users/:id-ს, სადაც
    // UsersService.update ხელახლა ამოწმებს — ისევე, როგორც მობილურის OTP-ის რეგისტრაციის
    // ნაკადშია (AuthService.register). ვადა/ცდების ლიმიტი (TTL, MAX_ATTEMPTS) საკმარისია.
    return true;
  }

  // ელფოსტის დონეზე მთვლელი ცდები, ცალკეული requestId-ისგან დამოუკიდებლად — ეს
  // ერგება ახალი კოდის ხელახლა გაგზავნის შემთხვევასაც (sendOtp ამ მთვლელს არ წმენდს).
  private registerFailure(email: string) {
    const now = Date.now();
    const existing = this.emailLocks.get(email);
    // წინა წარუმატებელი ცდიდან TTL-ზე მეტი რომ არ იყოს გასული — თორემ მთვლელს
    // ვწმენდთ (ეს "ფანჯარაა", არა blockedUntil-ზე დამოკიდებული, ასე რომ პირველივე
    // ჯერზეც (blockedUntil === 0) სწორად ითვლის).
    const attempts =
      existing && now - existing.lastFailureAt < this.TTL_MS
        ? existing.attempts + 1
        : 1;

    this.emailLocks.set(email, {
      attempts,
      blockedUntil: attempts >= this.MAX_ATTEMPTS ? now + this.LOCK_MS : 0,
      lastFailureAt: now,
    });
  }

  private cleanupExpired() {
    const now = Date.now();
    for (const [requestId, entry] of this.pending) {
      if (now > entry.expiresAt) {
        this.pending.delete(requestId);
        if (this.pendingRequestIdByEmail.get(entry.email) === requestId) {
          this.pendingRequestIdByEmail.delete(entry.email);
        }
      }
    }
    for (const [email, lock] of this.emailLocks) {
      // ან დაბლოკვის ვადა გავიდა, ან (blockedUntil === 0 — არასდროს მიღწეულა
      // MAX_ATTEMPTS) ბოლო წარუმატებელი ცდის TTL-ფანჯარაც კი გავიდა — ამ
      // შემთხვევაში registerFailure ისედაც თვლიდა attempts-ს თავიდან, ანუ ეს
      // ჩანაწერი აღარაფერს იცავს და მისი შენარჩუნება მხოლოდ Map-ს დიდხანს
      // მომუშავე პროცესში (ყოველი ოდესმე შეცდომით შეყვანილი კოდის ელფოსტისთვის)
      // შეუზღუდავად გაზრდიდა.
      const inactive =
        lock.blockedUntil !== 0
          ? now > lock.blockedUntil
          : now - lock.lastFailureAt > this.TTL_MS;
      if (inactive) {
        this.emailLocks.delete(email);
      }
    }
  }
}
