import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { CategoryModule } from './category/category.module';
import { AttributeModule } from './attribute/attribute.module';
import { ColorsModule } from './colors/colors.module';
import { ProductsModule } from './products/products.module';
import { CartModule } from './cart/cart.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { FavoritesModule } from './favorites/favorites.module';
import { AddressesModule } from './addresses/addresses.module';
import { BranchesModule } from './branches/branches.module';
import { CompaniesModule } from './companies/companies.module';
import { HeroSlidesModule } from './hero-slides/hero-slides.module';
import { ProductSlidersModule } from './product-sliders/product-sliders.module';
import { EmailService } from './common/email/email.service';

@Module({
  imports: [
    // 1. ConfigModule უნდა იყოს გლობალური
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // ⭐ სამომავლო cron job-ებისთვის (მაგ. შეკვეთების/ვაუჩერების ვადის გასულობის შემოწმება)
    ScheduleModule.forRoot(),

    // გლობალური rate limiting (brute-force login/OTP-spam-ისგან დასაცავად).
    // default limit ყველა endpoint-ს ეხება; auth/otp controller-ებში ცალკეული
    // route-ები @Throttle()-ით ამკაცრებენ ლიმიტს (იხ. AuthController, OtpController).
    //
    // ⚠️ ლიმიტი per-IP-ია, არა per-user: NAT-ის/კორპორატიული ქსელის/მობილური
    // ოპერატორის უკან მყოფი რამდენიმე მყიდველი ერთ IP-დ ჩანს, ერთი გვერდის
    // ჩატვირთვა კი ისედაც რამდენიმე პარალელურ მოთხოვნას აგზავნის. ამიტომ
    // default საკმაოდ თავისუფალია, კატალოგის (მხოლოდ-კითხვადი, არა-მგრძნობიარე)
    // controller-ები კი @SkipThrottle()-ით საერთოდ გამორიცხულია — იხ.
    // products/categories/colors/attributes/hero-slides/product-sliders.
    // მკაცრი ლიმიტი მიზნობრივად იქ დგას, სადაც საჭიროა (auth, otp).
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 წუთი
        limit: 120, // 120 მოთხოვნა წუთში ერთ IP-ზე (default)
      },
    ]),

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
        // synchronize მხოლოდ ლოკალურ დეველოპმენტში/ტესტებში — production-ში schema
        // migrations მართავს (იხ. src/migrations/, src/data-source.ts). ეს "fail
        // open" აღარაა: main.ts-ში ბუთის დასაწყისშივე ვამოწმებთ, რომ NODE_ENV
        // ცხადადაა ერთ-ერთი ცნობილი მნიშვნელობიდან (development/test/production) —
        // ამიტომ აქ `!== 'production'` ვეღარ "მოტყუვდება" ცარიელი/დაუშვებელი
        // NODE_ENV-ით, რომელიც აქამდე ჩუმად production ბაზაზეც synchronize:
        // true-ს გაუშვებდა.
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
    ColorsModule,
    ProductsModule,
    CartModule,
    OrdersModule,
    PaymentsModule,
    FavoritesModule,
    AddressesModule,
    BranchesModule,
    CompaniesModule,
    HeroSlidesModule,
    ProductSlidersModule,
  ],
  providers: [
    EmailService, // ← დარეგისტრირება
    { provide: APP_GUARD, useClass: ThrottlerGuard }, // გლობალური rate limiting
  ],
  exports: [EmailService], // ← ექსპორტი, რომ AuthService-მა გამოიყენოს
})
export class AppModule {}
