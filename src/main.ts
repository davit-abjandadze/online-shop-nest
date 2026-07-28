import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://192.168.0.126:3000',
    ],
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

  await app.listen(4000, '0.0.0.0');
}
bootstrap();