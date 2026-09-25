import { HttpException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';

// AuthService-ის უსაფრთხოების ლოგიკა: ელფოსტაზე login-ის ლიმიტი და
// Google-ით დაუდასტურებელი ანგარიშის „დაბრუნება" (account takeover-ის დაცვა).
describe('AuthService', () => {
  const buildService = (user: Record<string, unknown> | null) => {
    const usersService = {
      findByEmail: jest.fn().mockResolvedValue(user),
      claimAccountByVerifiedEmail: jest.fn().mockResolvedValue(undefined),
      create: jest.fn(),
    };
    const jwtService = { sign: jest.fn().mockReturnValue('signed-token') };
    const configService = {
      get: jest.fn((key: string) =>
        key === 'GOOGLE_CLIENT_ID' ? 'google-client-id' : undefined,
      ),
    };
    const service = new AuthService(
      usersService as never,
      jwtService as never,
      {} as never,
      {} as never,
      configService as never,
    );
    return { service, usersService };
  };

  describe('login lockout', () => {
    it('10 წარუმატებელი ცდის შემდეგ სწორ პაროლსაც აღარ უშვებს', async () => {
      const password = await bcrypt.hash('CorrectPass1', 4);
      const { service } = buildService({ id: 1, email: 'a@b.com', password });

      for (let i = 0; i < 10; i++) {
        await expect(
          service.login({ email: 'a@b.com', password: 'wrong-pass' }),
        ).rejects.toThrow(UnauthorizedException);
      }
      await expect(
        service.login({ email: 'a@b.com', password: 'CorrectPass1' }),
      ).rejects.toThrow(HttpException);
    });

    it('არარსებულ ელფოსტაზეც ერთნაირად ბლოკავს (enumeration-ის გარეშე)', async () => {
      const { service } = buildService(null);
      for (let i = 0; i < 10; i++) {
        await expect(
          service.login({ email: 'ghost@b.com', password: 'x' }),
        ).rejects.toThrow(UnauthorizedException);
      }
      const error = await service
        .login({ email: 'ghost@b.com', password: 'x' })
        .catch((e: HttpException) => e);
      expect((error as HttpException).getStatus()).toBe(429);
    });

    it('წარმატებული login მთვლელს ანულებს', async () => {
      const password = await bcrypt.hash('CorrectPass1', 4);
      const { service } = buildService({ id: 1, email: 'a@b.com', password });

      for (let i = 0; i < 9; i++) {
        await service
          .login({ email: 'a@b.com', password: 'wrong' })
          .catch(() => undefined);
      }
      await service.login({ email: 'a@b.com', password: 'CorrectPass1' });
      for (let i = 0; i < 9; i++) {
        await service
          .login({ email: 'a@b.com', password: 'wrong' })
          .catch(() => undefined);
      }
      await expect(
        service.login({ email: 'a@b.com', password: 'CorrectPass1' }),
      ).resolves.toHaveProperty('access_token');
    });
  });

  describe('googleLogin', () => {
    const mockGoogle = (service: AuthService) => {
      (service as unknown as { googleOAuthClient: unknown }).googleOAuthClient =
        {
          verifyIdToken: jest.fn().mockResolvedValue({
            getPayload: () => ({
              email: 'Victim@Gmail.com',
              email_verified: true,
            }),
          }),
        };
    };

    it('დაუდასტურებელ ანგარიშზე პაროლს აუქმებს და ელფოსტას ადასტურებს', async () => {
      const { service, usersService } = buildService({
        id: 7,
        email: 'victim@gmail.com',
        isEmailVerified: false,
      });
      mockGoogle(service);

      const result = await service.googleLogin('id-token');

      expect(usersService.findByEmail).toHaveBeenCalledWith('victim@gmail.com');
      expect(usersService.claimAccountByVerifiedEmail).toHaveBeenCalledWith(
        7,
        expect.any(String),
      );
      expect(result.user.isEmailVerified).toBe(true);
    });

    it('უკვე დადასტურებულ ანგარიშს არ ეხება', async () => {
      const { service, usersService } = buildService({
        id: 7,
        email: 'victim@gmail.com',
        isEmailVerified: true,
      });
      mockGoogle(service);

      await service.googleLogin('id-token');

      expect(usersService.claimAccountByVerifiedEmail).not.toHaveBeenCalled();
    });
  });
});
