import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';
import { normalizePhoneForCompare } from '../common/utils/phone.util';

interface IssuedOtp {
  phone: string;
  expiresAt: number;
}

// verify.ge-ს (https://verify.ge) REST API-ის თხელი wrapper-ი — მობილურის OTP-ით
// დადასტურებისთვის (რეგისტრაციის ან სხვა მგრძნობიარე მოქმედების წინ).
//
// ⚠️ Free tier-ის შეზღუდვა: verify.ge-ს უფასო ტარიფი კოდს მხოლოდ ანგარიშზე
// რეგისტრირებულ (ტესტ) ნომერზე აგზავნის — ნებისმიერი მომხმარებლის ნომერზე
// გასაგზავნად საჭიროა Starter ტარიფზე გადასვლა (იხ. https://verify.ge/en/pricing).
@Injectable()
export class OtpService {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  // requestId → რომელ ნომერზე გაიცა. verify.ge-ს verify endpoint-ი ნომერს არ
  // ამოწმებს (მხოლოდ requestId+code-ს), ამიტომ ამის გარეშე ერთი, საკუთარ
  // ნომერზე მიღებული კოდით ნებისმიერი (მაგ. სხვისი) ნომრის „დამოწმება"
  // შეიძლებოდა register/PATCH /users-ზე. ჩანაწერი consumeVerifiedOtp-ზე იშლება,
  // ანუ ერთი კოდი ერთხელ გამოიყენება.
  // ⚠️ In-memory — იგივე შეზღუდვა, რაც EmailOtpService-ს (restart შლის,
  // მრავალინსტანციან გარემოში Redis დასჭირდება).
  private readonly issued = new Map<string, IssuedOtp>();
  // ნომერზე ბოლო გაგზავნების დროები — per-IP throttle-ს IP-ების როტაციით
  // გვერდს უვლიან, ამიტომ ერთ ნომერზე დამატებით ლიმიტი გვაქვს.
  private readonly sendsByPhone = new Map<string, number[]>();
  private readonly ISSUED_TTL_MS = 15 * 60 * 1000; // 15 წუთი
  private readonly SEND_WINDOW_MS = 60 * 60 * 1000; // 1 საათი
  private readonly MAX_SENDS_PER_WINDOW = 5;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl =
      this.configService.get<string>('VERIFY_GE_BASE_URL') ||
      'https://api.verify.ge/api/v1';
    this.apiKey = this.configService.get<string>('VERIFY_GE_API_KEY') || '';
  }

  // OTP კოდის გაგზავნა მითითებულ ნომერზე. აბრუნებს requestId-ს, რომელიც
  // შემდეგ verify-ს დროს უნდა გადმოეცეს.
  async sendOtp(phoneNumber: string): Promise<{ requestId: string }> {
    if (!this.apiKey) {
      throw new InternalServerErrorException(
        'VERIFY_GE_API_KEY არ არის დაყენებული — SMS ვერიფიკაცია არ არის კონფიგურირებული',
      );
    }

    this.cleanupExpired();
    const phoneKey = normalizePhoneForCompare(phoneNumber);
    const now = Date.now();
    const recentSends = (this.sendsByPhone.get(phoneKey) ?? []).filter(
      (sentAt) => now - sentAt < this.SEND_WINDOW_MS,
    );
    if (recentSends.length >= this.MAX_SENDS_PER_WINDOW) {
      throw new HttpException(
        'ამ ნომერზე კოდის გაგზავნის ლიმიტი ამოწურულია — სცადეთ მოგვიანებით',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    recentSends.push(now);
    this.sendsByPhone.set(phoneKey, recentSends);

    try {
      const response = await firstValueFrom(
        this.httpService.post<{ data?: { requestId?: string } }>(
          `${this.baseUrl}/otp/send`,
          {
            phoneNumber,
            channel: 'SMS',
          },
          { headers: { Authorization: `Bearer ${this.apiKey}` } },
        ),
      );

      // ⚠️ verify.ge-ს რეალური წარმატებული პასუხი bare `{ requestId }`-ს კი არა,
      // `{ success: true, data: { requestId, expiresAt, status }, meta: {...} }`-ს
      // აბრუნებს — requestId ჩალაგებულია `data`-ქვეშ (`meta.requestId` კი სულ სხვა
      // ველია: verify.ge-ს საკუთარი request-tracking id, არა ჩვენი OTP-ის).
      const requestId = response.data?.data?.requestId;

      if (!requestId) {
        console.error(
          'verify.ge /otp/send: მოულოდნელი პასუხის ფორმატი (requestId ვერ მოიძებნა):',
          JSON.stringify(response.data),
        );
        throw new BadRequestException(
          'OTP-ის გაგზავნა ვერ მოხერხდა — მოწოდებულმა სერვისმა მოულოდნელი პასუხი დააბრუნა',
        );
      }

      this.issued.set(requestId, {
        phone: phoneKey,
        expiresAt: Date.now() + this.ISSUED_TTL_MS,
      });
      return { requestId };
    } catch (error) {
      this.handleError(error, 'OTP-ის გაგზავნა ვერ მოხერხდა');
    }
  }

  // register/PATCH /users-ისთვის: ამოწმებს, რომ requestId სწორედ `phoneNumber`-ზე
  // გაიცა, კოდი სწორია და requestId ჯერ არ გამოყენებულა — წარმატებისას მას
  // მოიხმარს (ხელახლა ვეღარ გამოიყენება). POST /otp/verify (UI-ის feedback)
  // კვლავ verifyOtp-ს იძახებს და requestId-ს არ მოიხმარს.
  async consumeVerifiedOtp(
    requestId: string,
    code: string,
    phoneNumber: string,
  ): Promise<boolean> {
    const entry = this.issued.get(requestId);
    if (
      !entry ||
      Date.now() > entry.expiresAt ||
      entry.phone !== normalizePhoneForCompare(phoneNumber)
    ) {
      return false;
    }

    // ჩანაწერს await-მდე ვშლით, რომ ორმა პარალელურმა მოთხოვნამ ერთი და იგივე
    // requestId ორჯერ ვერ მოიხმაროს; წარუმატებლობისას ვაბრუნებთ.
    this.issued.delete(requestId);
    let verified = false;
    try {
      verified = await this.verifyOtp(requestId, code);
    } finally {
      if (!verified) this.issued.set(requestId, entry);
    }
    return verified;
  }

  private cleanupExpired() {
    const now = Date.now();
    for (const [requestId, entry] of this.issued) {
      if (now > entry.expiresAt) this.issued.delete(requestId);
    }
    for (const [phone, sends] of this.sendsByPhone) {
      if (sends.every((sentAt) => now - sentAt >= this.SEND_WINDOW_MS)) {
        this.sendsByPhone.delete(phone);
      }
    }
  }

  // ადრე გაგზავნილი OTP-ის დადასტურება. აბრუნებს true-ს, თუ კოდი სწორია.
  async verifyOtp(requestId: string, code: string): Promise<boolean> {
    if (!this.apiKey) {
      throw new InternalServerErrorException(
        'VERIFY_GE_API_KEY არ არის დაყენებული — SMS ვერიფიკაცია არ არის კონფიგურირებული',
      );
    }

    try {
      const response = await firstValueFrom(
        this.httpService.post<{ success: boolean }>(
          `${this.baseUrl}/otp/verify`,
          { requestId, code },
          { headers: { Authorization: `Bearer ${this.apiKey}` } },
        ),
      );

      return Boolean(response.data.success);
    } catch (error) {
      // ⚠️ verify.ge-ს OTP ერთჯერადია — თუ ეს კონკრეტული requestId+code უკვე
      // ერთხელ წარმატებით გადამოწმდა (მაგ. frontend-მა თავად გამოიძახა
      // POST /otp/verify UI-ის feedback-ისთვის), ხელახალი verify.ge-სკენ
      // მოთხოვნა "OTP has already been verified" 400-ს აბრუნებს. ეს იმას
      // ნიშნავს, რომ კოდი მართებული იყო — ამიტომ ვთვლით წარმატებულად და არა
      // შეცდომად, თორემ /users PATCH ყოველთვის ჩავარდებოდა, თუ მომხმარებელმა
      // ჯერ /otp/verify-ით შეამოწმა კოდი UI-ზე.
      const axiosError = error as AxiosError<{
        message?: string;
        error?: { message?: string };
      }>;
      const apiMessage =
        axiosError?.response?.data?.message ||
        axiosError?.response?.data?.error?.message;
      if (apiMessage && /already been verified/i.test(apiMessage)) {
        return true;
      }
      this.handleError(error, 'OTP-ის დადასტურება ვერ მოხერხდა');
    }
  }

  private handleError(error: unknown, fallbackMessage: string): never {
    // ჩვენ მიერვე დაგენერირებული HttpException-ები (მაგ. requestId-ის ვერ
    // პოვნის შემთხვევა ზემოთ) იმისთვის კი არ არის შემოხვეული, რომ ხელახლა
    // Axios-ის შეცდომად ჩაითვალოს — ისე გავუშვათ, როგორც არის.
    if (error instanceof HttpException) {
      throw error;
    }

    const axiosError = error as AxiosError<{
      message?: string;
      error?: { message?: string };
    }>;
    const apiMessage =
      axiosError?.response?.data?.message ||
      axiosError?.response?.data?.error?.message;
    // მუშა გარემოში დავალოგოთ სრული პასუხი (client-ს კი მოკლე მესიჯს ვუბრუნებთ) —
    // verify.ge-ს შეცდომები error.message-ქვეშაა ჩალაგებული, არა message-ზე პირდაპირ.
    if (!apiMessage) {
      console.error(
        'verify.ge error:',
        axiosError?.response?.status,
        JSON.stringify(axiosError?.response?.data),
      );
    }
    throw new BadRequestException(apiMessage || fallbackMessage);
  }
}
