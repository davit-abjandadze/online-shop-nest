import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Company } from './entities/company.entity';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { FindCompaniesDto } from './dto/find-companies.dto';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { resolveSortColumn } from '../common/dto/pagination.dto';

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
    { page = 1, limit = 10, sortBy, order = 'DESC' }: FindCompaniesDto,
    where: Partial<Pick<Company, 'isActive'>>,
  ): Promise<PaginatedResponseDto<Company>> {
    const sortColumn = resolveSortColumn(sortBy, SORTABLE_COLUMNS, 'sortOrder');
    const [data, total] = await this.companyRepository.findAndCount({
      where,
      order: { [sortColumn]: order, id: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return new PaginatedResponseDto(data, total, page, limit);
  }

  async findOne(id: string): Promise<Company> {
    const company = await this.companyRepository.findOne({ where: { id } });
    if (!company) {
      throw new NotFoundException(`კომპანია ID-ით ${id} ვერ მოიძებნა`);
    }
    return company;
  }

  async create(dto: CreateCompanyDto): Promise<Company> {
    const company = this.companyRepository.create(dto as Partial<Company>);
    return this.companyRepository.save(company);
  }

  async update(id: string, dto: UpdateCompanyDto): Promise<Company> {
    const company = await this.findOne(id);
    Object.assign(company, dto);
    return this.companyRepository.save(company);
  }

  async remove(id: string): Promise<void> {
    const company = await this.findOne(id);
    await this.companyRepository.remove(company);
  }
}
