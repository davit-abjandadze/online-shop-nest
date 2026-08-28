import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';

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

    try {
      const response = await firstValueFrom(
        this.httpService.post<{ requestId: string }>(
          `${this.baseUrl}/otp/send`,
          {
            phoneNumber,
            channel: 'SMS',
          },
          { headers: { Authorization: `Bearer ${this.apiKey}` } },
        ),
      );

      return { requestId: response.data.requestId };
    } catch (error) {
      this.handleError(error, 'OTP-ის გაგზავნა ვერ მოხერხდა');
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
      this.handleError(error, 'OTP-ის დადასტურება ვერ მოხერხდა');
    }
  }

  private handleError(error: unknown, fallbackMessage: string): never {
    const axiosError = error as AxiosError<{ message?: string; error?: { message?: string } }>;
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
