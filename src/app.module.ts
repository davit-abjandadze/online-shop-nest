import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { CategoryModule } from './category/category.module';
import { AttributeModule } from './attribute/attribute.module';
import { ProductsModule } from './products/products.module';
import { CartModule } from './cart/cart.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { EmailService } from './common/email/email.service';

@Module({
  imports: [
    // 1. ConfigModule უნდა იყოს გლობალური
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // ⭐ სამომავლო cron job-ებისთვის (მაგ. შეკვეთების/ვაუჩერების ვადის გასულობის შემოწმება)
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
        // synchronize მხოლოდ ლოკალურ დეველოპმენტში — production-ში schema
        // migrations მართავს (იხ. src/migrations/, src/data-source.ts).
        synchronize: process.env.NODE_ENV !== 'production',
        migrations: [__dirname + '/migrations/*{.ts,.js}'],
        migrationsRun: process.env.NODE_ENV === 'production',
        // RDS-ის default parameter group-ს rds.force_ssl=1 აქვს (SSL-ის გარეშე
        // კავშირს pg_hba.conf საერთოდ არ უშვებს) — production-ში ვრთავთ SSL-ს.
        // rejectUnauthorized: false, რადგან RDS-ის CA bundle-ს არ ვამატებთ.
        ssl:
          process.env.NODE_ENV === 'production'
            ? { rejectUnauthorized: false }
            : false,
      }),
    }),

    // 3. შენი მოდულები
    UsersModule,
    AuthModule,
    CategoryModule,
    AttributeModule,
    ProductsModule,
    CartModule,
    OrdersModule,
    PaymentsModule,
  ],
  providers: [EmailService], // ← დარეგისტრირება
  exports: [EmailService], // ← ექსპორტი, რომ AuthService-მა გამოიყენოს
})
export class AppModule {}
