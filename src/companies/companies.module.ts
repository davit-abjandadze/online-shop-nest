import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Company } from './entities/company.entity';
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';

@Module({
  imports: [TypeOrmModule.forFeature([Company])],
  controllers: [CompaniesController],
  providers: [CompaniesService],
  // BranchesModule/ProductsModule-ს დასჭირდება companyId-ის არსებობის
  // შესამოწმებლად (Branch/Product create-ისას).
  exports: [CompaniesService],
})
export class CompaniesModule {}
