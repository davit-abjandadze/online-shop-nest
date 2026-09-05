import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { writeFileSync } from 'fs';
import { join } from 'path';
import type { Application } from 'express';
import { AppModule } from './app.module';

const VALID_NODE_ENVS = ['development', 'test', 'production'];

async function bootstrap() {
  // NODE_ENV-ს app.module.ts-ში synchronize/migrationsRun (schema-ის ავტომატური
  // სინქრონიზაცია/migration-ების გაშვება) და ქვემოთ production-ის Swagger UI-ის
  // ჩართვა/გამორთვა ეყრდნობა. ეს ყველაფერი "fail closed" პრინციპით მუშაობს
  // მხოლოდ მაშინ, თუ NODE_ENV ცხადადაა მითითებული — ცარიელი/დაუშვებელი მნიშვნელობა
  // აქამდე ჩუმად "არა-production"-ად (ანუ synchronize: true-დ) ითვლებოდა, რაც
  // production ბაზაზე შემთხვევით deploy-ის შემთხვევაში schema-ს ავტომატურად
  // შეცვლიდა/დაარღვევდა. ამიტომ აქ ცხადად ვამოწმებთ, ვიდრე AppModule/TypeORM
  // საერთოდ შეიქმნება.
  if (
    !process.env.NODE_ENV ||
    !VALID_NODE_ENVS.includes(process.env.NODE_ENV)
  ) {
    throw new Error(
      `NODE_ENV გარემოს ცვლადი აუცილებელია და უნდა იყოს ერთ-ერთი: ${VALID_NODE_ENVS.join(', ')} ` +
        `(მიღებულია: ${JSON.stringify(process.env.NODE_ENV)}). იხ. src/app.module.ts.`,
    );
  }

  // User.personalNumber/phoneNumber ბაზაში დაშიფრულად ინახება (encryption.util.ts) —
  // ENCRYPTION_KEY-ის გარეშე ეს ველები საერთოდ ვერ დაიწერება/წაიკითხება, ამიტომ ბუთის
  // დასაწყისშივე ვამოწმებთ, რომ ცხადი, გასაგები შეცდომა დაგვხვდეს, ვიდრე პირველ
  // login/register-ზე გაუგებარ decrypt-ის ჩავარდნას დავხვდებოდით.
  if (!process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY.length !== 64) {
    throw new Error(
      'ENCRYPTION_KEY გარემოს ცვლადი აუცილებელია და უნდა შეიცავდეს ზუსტად 64 hex სიმბოლოს (32 ბაიტი) — ' +
        'გენერაცია: `openssl rand -hex 32`. იხ. src/common/utils/encryption.util.ts',
    );
  }

  // rawBody: true — Payments-ის BOG callback route-ს (POST /payments/callback/bog)
  // სჭირდება ნედლი (raw) request body ბაიტები ხელმოწერის (Callback-Signature)
  // ვერიფიკაციისთვის; parse-ილი JSON-ის ხელახლა serialize-ვა ველების
  // თანმიმდევრობას არღვევს და ხელმოწერას ბათილს ხდის.
  const app = await NestFactory.create(AppModule, { rawBody: true });

  // ⚠️ ThrottlerGuard (per-IP rate limit, იხ. AppModule) კლიენტის IP-ს Express-ის
  // req.ip-იდან იღებს. reverse proxy-ის (nginx/CDN) უკან req.ip ყოველთვის proxy-ის
  // მისამართია, ანუ მთელი ტრაფიკი ერთ „მომხმარებლად" ჩაითვლებოდა და
  // login-ის 5/წთ ლიმიტი მთელ საიტს დაბლოკავდა. TRUST_PROXY-ს დაყენებისას
  // X-Forwarded-For-ს ვენდობით და რეალურ IP-ს ვიღებთ.
  //
  // განზრახ env-ით იმართება და default-ად გამორთულია: თუ აპლიკაცია პირდაპირ
  // ინტერნეტშია (proxy-ის გარეშე), trust proxy-ის ჩართვა საშუალებას მისცემდა
  // ნებისმიერს, X-Forwarded-For-ის გაყალბებით rate limit-ს გვერდი აუაროს.
  // მნიშვნელობა: proxy-ების რაოდენობა (მაგ. `1`), ან `true` (ყველას ვენდობით).
  const trustProxy = process.env.TRUST_PROXY;
  if (trustProxy) {
    const value = /^\d+$/.test(trustProxy)
      ? Number(trustProxy)
      : trustProxy === 'true'
        ? true
        : trustProxy;
    const expressApp = app.getHttpAdapter().getInstance() as Application;
    expressApp.set('trust proxy', value);
  }

  // CORS_ORIGINS env-ით (მძიმით გამოყოფილი სია) production დომენების დასამატებლად,
  // ხოლო თუ არაა მითითებული — ლოკალური dev origin-ები ისევ მუშაობს, როგორც ადრე.
  const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((origin) => origin.trim())
    : ['http://localhost:3000', 'http://localhost:3001'];

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });
  // ვალიდაციის პაიპი - ავტომატურად შეამოწმებს DTO-ებს
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // წაშლის ყველა ველს, რომელიც DTO-ში არ არის
      forbidNonWhitelisted: true, // შეცდომას მოგვცემს, თუ ზედმეტ ველს გაგზავნიან
      transform: true, // ავტომატურად გარდაქმნის ტიპებს (მაგ. string -> number)
    }),
  );

  // Swagger-ის კონფიგურაცია
  const config = new DocumentBuilder()
    .setTitle('Online Shop API')
    .setDescription('REST API for the online shop backend')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);

  // production-ში Swagger UI (/api) საჯაროდ არ იხსნება — API-ის სტრუქტურის
  // (endpoint-ები, DTO-ები) გამჟღავნება არ გვინდა გარეშე პირისთვის.
  // swagger.json ფაილი მაინც იწერება ქვემოთ ყოველთვის, რადგან ის ფრონტენდის
  // `yarn generate:api`-ს სჭირდება (წაკითხვა ხდება ფაილიდან, არა HTTP-ით).
  if (process.env.NODE_ENV !== 'production') {
    SwaggerModule.setup('api', app, document);
  }

  // ყოველ სტარტზე ავტომატურად გენერირდება/განახლდება swagger.json,
  // რომ ფრონტმა ყოველთვის ახალი schema-დან შეძლოს ტიპების/კლიენტის გენერაცია.
  // production კონტეინერში ფაილსისტემა ეფემერულია და ეს ფაილი არავის სჭირდება იქ,
  // ამიტომ ჩავარდნაზე მხოლოდ warning-ს ვწერთ და ბუთს არ ვწყვეტთ.
  try {
    writeFileSync(
      join(process.cwd(), 'swagger.json'),
      JSON.stringify(document, null, 2),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn('swagger.json ვერ ჩაიწერა:', message);
  }

  // PORT-ის არასწორი მნიშვნელობა (მაგ. ცარიელი სტრიქონი, ტექსტი) NaN-ს იძლევა —
  // app.listen(NaN)-ის ქცევა undefined behavior-ია, ამიტომ ცხადად ვამოწმებთ.
  let port = 5000;
  if (process.env.PORT) {
    const parsed = parseInt(process.env.PORT, 10);
    if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) {
      throw new Error(
        `PORT გარემოს ცვლადი არასწორია: ${JSON.stringify(process.env.PORT)} — უნდა იყოს 1-65535 შორის მთელი რიცხვი.`,
      );
    }
    port = parsed;
  }
  await app.listen(port, '0.0.0.0');
}
bootstrap().catch((err) => {
  // NestFactory.create/app.listen-ის ან ზემოთ env-ვალიდაციის ჩავარდნა (მაგ. DB
  // მიუწვდომელია ბუთზე) წინააღმდეგ შემთხვევაში unhandled promise rejection-ად
  // დარჩებოდა — ორქესტრატორმა (Docker/PM2/k8s) ვერ დაინახავდა ცხადად ჩავარდნილ
  // exit code-ს.
  console.error('აპლიკაციის ბუთი ჩავარდა:', err);
  process.exit(1);
});
