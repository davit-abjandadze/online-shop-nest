import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { UsersModule } from './users/users.module';
import { TasksModule } from './tasks/tasks.module';
import { AuthModule } from './auth/auth.module';
import { QuestionModule } from './question/question.module';
import { AnswerModule } from './answer/answer.module';
import { UserAnswerModule } from './user-answer/user-answer.module';
import { CategoryModule } from './category/category.module';
import { FavoriteModule } from './favorite/favorite.module';
import { EmailService } from './common/email/email.service';
import { StatsModule } from './stats/stats.module';

@Module({
  imports: [
    // 1. ConfigModule უნდა იყოს გლობალური
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // ⭐ ვადაგასული კითხვების ავტომატური დეაქტივაციისთვის (cron)
    ScheduleModule.forRoot(),

    // 2. TypeORM-ის კავშირი
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT'),
        username: configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_DATABASE'),
        autoLoadEntities: true, // ავტომატურად იპოვის ყველა Entity-ს
        synchronize: true, // მხოლოდ დეველოპმენტისთვის!
      }),
    }),

    // 3. შენი მოდულები
    UsersModule,
    TasksModule,
    AuthModule,
    QuestionModule,
    CategoryModule,
    AnswerModule,
    UserAnswerModule,
    FavoriteModule,
    AuthModule,
    UsersModule,
    StatsModule,
  ],
  providers: [EmailService], // ← დარეგისტრირება
  exports: [EmailService],   // ← ექსპორტი, რომ AuthService-მა გამოიყენოს
})
export class AppModule {}