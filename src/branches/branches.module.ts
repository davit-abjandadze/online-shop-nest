import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Branch } from './entities/branch.entity';
import { ProductBranch } from '../products/entities/product-branch.entity';
import { BranchesController } from './branches.controller';
import { BranchesService } from './branches.service';
import { CompaniesModule } from '../companies/companies.module';

@Module({
  // CompaniesModule იმპორტირებულია CompaniesService-ის (findOne) გამოსაყენებლად
  // Branch create/update-ის companyId ვალიდაციისთვის — CategoryModule-ის
  // Attribute-ის იგივე პატერნით, ციკლური დამოკიდებულების გარეშე. ProductBranch
  // პირდაპირაა რეგისტრირებული (ProductsModule-ის სრული იმპორტის გარეშე) —
  // მხოლოდ findAvailableForProducts-ის query-სთვისაა საჭირო.
  imports: [TypeOrmModule.forFeature([Branch, ProductBranch]), CompaniesModule],
  controllers: [BranchesController],
  providers: [BranchesService],
  exports: [BranchesService],
})
export class BranchesModule {}
