import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS_ORIGINS env-ით (მძიმით გამოყოფილი სია) production დომენების დასამატებლად,
  // ხოლო თუ არაა მითითებული — ლოკალური dev origin-ები ისევ მუშაობს, როგორც ადრე.
  const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((origin) => origin.trim())
    : [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://192.168.0.126:3000',
      ];

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
    .setTitle('My First Nest API')
    .setDescription('The API description')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

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
    console.warn('swagger.json ვერ ჩაიწერა:', err.message);
  }

  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;
  await app.listen(port, '0.0.0.0');
}
bootstrap();
