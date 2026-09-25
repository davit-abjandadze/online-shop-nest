import { HttpException } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { OtpService } from './otp.service';

// OtpService.consumeVerifiedOtp — register/PATCH /users-ის ერთადერთი ბარიერი,
// რომელიც ამოწმებს, რომ OTP სწორედ იმ ნომერზე გაიცა, რომელსაც ამ ანგარიშზე
// ვწერთ, და რომ ერთი კოდი ერთხელ გამოიყენება (verify.ge თავად ნომერს არ
// ამოწმებს). რეგრესია აქ სხვისი ნომრის „დამოწმებას" ნიშნავს.
describe('OtpService', () => {
  const buildService = () => {
    let sent = 0;
    const httpService = {
      post: jest.fn((url: string) => {
        if (url.endsWith('/otp/send')) {
          sent += 1;
          return of({ data: { data: { requestId: `req-${sent}` } } });
        }
        // verify.ge: პირველი verify წარმატებულია, შემდეგები "already verified"
        return of({ data: { success: true } });
      }),
    };
    const configService = {
      get: jest.fn((key: string) =>
        key === 'VERIFY_GE_API_KEY' ? 'test-key' : undefined,
      ),
    };
    const service = new OtpService(httpService as any, configService as any);
    return { service, httpService };
  };

  it('ადასტურებს კოდს იმავე ნომერზე, სხვა ფორმატითაც', async () => {
    const { service } = buildService();
    const { requestId } = await service.sendOtp('+995599123456');

    await expect(
      service.consumeVerifiedOtp(requestId, '1234', '599 12 34 56'),
    ).resolves.toBe(true);
  });

  it('უარყოფს სხვა ნომერზე გაცემულ requestId-ს', async () => {
    const { service, httpService } = buildService();
    const { requestId } = await service.sendOtp('599123456');

    await expect(
      service.consumeVerifiedOtp(requestId, '1234', '599000000'),
    ).resolves.toBe(false);
    // verify.ge-ს საერთოდ არ ვეკითხებით
    expect(httpService.post).toHaveBeenCalledTimes(1);
  });

  it('ერთი requestId მეორედ ვეღარ გამოიყენება', async () => {
    const { service } = buildService();
    const { requestId } = await service.sendOtp('599123456');

    await expect(
      service.consumeVerifiedOtp(requestId, '1234', '599123456'),
    ).resolves.toBe(true);
    await expect(
      service.consumeVerifiedOtp(requestId, '1234', '599123456'),
    ).resolves.toBe(false);
  });

  it('არასწორი კოდის შემდეგ requestId კვლავ გამოყენებადია', async () => {
    const { service, httpService } = buildService();
    const { requestId } = await service.sendOtp('599123456');

    httpService.post.mockImplementationOnce(() =>
      throwError(() => ({ response: { data: { message: 'Invalid code' } } })),
    );
    await expect(
      service.consumeVerifiedOtp(requestId, '0000', '599123456'),
    ).rejects.toThrow();
    await expect(
      service.consumeVerifiedOtp(requestId, '1234', '599123456'),
    ).resolves.toBe(true);
  });

  it('ერთ ნომერზე საათში 5-ზე მეტ გაგზავნას ბლოკავს', async () => {
    const { service } = buildService();
    for (let i = 0; i < 5; i++) {
      await service.sendOtp('599123456');
    }
    await expect(service.sendOtp('+995 599123456')).rejects.toThrow(
      HttpException,
    );
    // სხვა ნომერზე ლიმიტი არ ვრცელდება
    await expect(service.sendOtp('599000000')).resolves.toBeDefined();
  });
});
