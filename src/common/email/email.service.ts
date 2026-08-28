import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter;

  constructor(private configService: ConfigService) {
    // ვქმნით ტრანსპორტიორს Gmail-ისთვის
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: this.configService.get<string>('EMAIL_USER'),
        pass: this.configService.get<string>('EMAIL_PASS'),
      },
    });
  }

  async sendPasswordResetEmail(to: string, token: string) {
    const resetUrl = `${this.configService.get('FRONTEND_URL')}/ka/reset-password?token=${token}`;

    const mailOptions = {
      from: `"Online Shop" <${this.configService.get('EMAIL_USER')}>`,
      to: to,
      subject: 'პაროლის აღდგენა',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
          <h2 style="color: #333;">პაროლის აღდგენა</h2>
          <p>თქვენ მოითხოვეთ პაროლის აღდგენა თქვენი ანგარიშისთვის.</p>
          <p>პაროლის შესაცვლელად, გთხოვთ, დააჭიროთ ქვემოთ მოცემულ ბმულს:</p>
          <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #0070f3; color: white; text-decoration: none; border-radius: 4px; font-weight: bold; margin: 20px 0;">
            პაროლის აღდგენა
          </a>
          <p style="color: #666; font-size: 14px; margin-top: 20px;">
            ეს ბმული მოქმედებს 1 საათის განმავლობაში. თუ თქვენ არ მოგითხოვიათ პაროლის აღდგენა, უბრალოდ დააიგნორეთ ეს მეილი.
          </p>
        </div>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      this.logger.log(`Password reset email sent successfully to ${to}`);
    } catch (error) {
      this.logger.error(
        `Failed to send email to ${to}`,
        (error as Error).stack,
      );
      throw new Error('მეილის გაგზავნა ვერ მოხერხდა');
    }
  }

  // ელფოსტის დადასტურების OTP კოდის გაგზავნა (მაგ. პროფილში ელფოსტის შეცვლის წინ).
  async sendOtpEmail(to: string, code: string) {
    const mailOptions = {
      from: `"Online Shop" <${this.configService.get('EMAIL_USER')}>`,
      to: to,
      subject: 'ელფოსტის დადასტურების კოდი',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
          <h2 style="color: #333;">ელფოსტის დადასტურება</h2>
          <p>თქვენი დადასტურების კოდია:</p>
          <div style="font-size: 28px; font-weight: bold; letter-spacing: 4px; padding: 12px 0;">${code}</div>
          <p style="color: #666; font-size: 14px; margin-top: 20px;">
            კოდი მოქმედია 10 წუთის განმავლობაში. თუ თქვენ არ მოგითხოვიათ ეს კოდი, უბრალოდ დააიგნორეთ ეს მეილი.
          </p>
        </div>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      this.logger.log(`OTP email sent successfully to ${to}`);
    } catch (error) {
      this.logger.error(
        `Failed to send OTP email to ${to}`,
        (error as Error).stack,
      );
      throw new Error('მეილის გაგზავნა ვერ მოხერხდა');
    }
  }
}
