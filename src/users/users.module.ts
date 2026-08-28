import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from './entities/user.entity';
import { OtpModule } from '../otp/otp.module';

@Module({
  imports: [TypeOrmModule.forFeature([User]), OtpModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService], // ← ეს დაამატე!
})
export class UsersModule {}
