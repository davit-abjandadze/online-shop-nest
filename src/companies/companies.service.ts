import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Company } from './entities/company.entity';
import { Order } from '../orders/entities/order.entity';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { FindCompaniesDto } from './dto/find-companies.dto';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { paginate } from '../common/utils/paginate.util';

// sortBy პირდაპირ user-ისგან query string-იდან მოდის — SQL injection-ის
// თავიდან ასაცილებლად ვუშვებთ მხოლოდ ცნობილ სვეტებს (category/products
// მოდულების იგივე pattern).
const SORTABLE_COLUMNS = new Set(['id', 'name', 'sortOrder', 'createdAt']);

@Injectable()
export class CompaniesService {
  constructor(
    @InjectRepository(Company)
    private companyRepository: Repository<Company>,
  ) {}

  // საჯარო სია — checkout/კატალოგში მხოლოდ აქტიური კომპანიები.
  async findAllActive(
    dto: FindCompaniesDto,
  ): Promise<PaginatedResponseDto<Company>> {
    return this.findAllPaginated(dto, { isActive: true });
  }

  // ადმინის დეშბორდი დახურულ კომპანიებსაც ხედავს.
  async findAllAdmin(
    dto: FindCompaniesDto,
  ): Promise<PaginatedResponseDto<Company>> {
    return this.findAllPaginated(dto, {});
  }

  private async findAllPaginated(
    dto: FindCompaniesDto,
    where: Partial<Pick<Company, 'isActive'>>,
  ): Promise<PaginatedResponseDto<Company>> {
    const qb = this.companyRepository.createQueryBuilder('company');
    if (where.isActive !== undefined) {
      qb.andWhere('company.isActive = :isActive', {
        isActive: where.isActive,
      });
    }
    return paginate(qb, 'company', dto, SORTABLE_COLUMNS, 'sortOrder', {
      secondaryOrderBy: { column: 'company.id', direction: 'ASC' },
    });
  }

  // isAdmin=false (default) — დახურული კომპანია 404-ს აბრუნებს, findAllActive-ის
  // იგივე isActive პატერნი, რომ ID enumeration-ითაც არ გამჟღავნდეს დახურული
  // კომპანიის არსებობა. შიდა გამომძახებლები (update/remove) ყოველთვის
  // isAdmin=true-თი იძახებენ, რომ დახურულის მართვაც შესაძლებელი დარჩეს.
  async findOne(id: string, isAdmin = false): Promise<Company> {
    const company = await this.companyRepository.findOne({ where: { id } });
    if (!company || (!isAdmin && !company.isActive)) {
      throw new NotFoundException(`კომპანია ID-ით ${id} ვერ მოიძებნა`);
    }
    return company;
  }

  async create(dto: CreateCompanyDto): Promise<Company> {
    const company = this.companyRepository.create(dto as Partial<Company>);
    return this.companyRepository.save(company);
  }

  async update(id: string, dto: UpdateCompanyDto): Promise<Company> {
    const company = await this.findOne(id, true);
    Object.assign(company, dto);
    return this.companyRepository.save(company);
  }

  async remove(id: string): Promise<void> {
    const company = await this.findOne(id, true);

    // Branch.company CASCADE-ია, Order.branch კი SET NULL — კომპანიის წაშლა
    // მის ყველა ფილიალს შლიდა, ძველ pickup შეკვეთებს ფილიალი ეკარგებოდათ და
    // ფილიალების გაყიდვები სტატისტიკიდან (innerJoin order.branch) ქრებოდა.
    // ისტორიის მქონე კომპანია isActive=false-ით უნდა დაიმალოს.
    const ordersViaBranches = await this.companyRepository.manager.count(
      Order,
      { where: { branch: { company: { id } } } },
    );
    if (ordersViaBranches > 0) {
      throw new ConflictException(
        `კომპანიის წაშლა შეუძლებელია — მის ფილიალებზე ${ordersViaBranches} შეკვეთაა გაფორმებული. გამორთეთ კომპანია (isActive: false)`,
      );
    }

    await this.companyRepository.remove(company);
  }
}
