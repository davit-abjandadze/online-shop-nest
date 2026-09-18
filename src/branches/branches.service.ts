import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Branch } from './entities/branch.entity';
import { ProductBranch } from '../products/entities/product-branch.entity';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { FindBranchesDto } from './dto/find-branches.dto';
import { CompaniesService } from '../companies/companies.service';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { paginate } from '../common/utils/paginate.util';

// sortBy პირდაპირ user-ისგან query string-იდან მოდის — SQL injection-ის
// თავიდან ასაცილებლად ვუშვებთ მხოლოდ ცნობილ სვეტებს (category/products
// მოდულების იგივე pattern). 'name' განზრახ არ არის შიგნით — Branch-ის
// შესაბამისი სვეტი სინამდვილეში 'title'-ია, orderBy('branch.name', ...)
// invalid-column 500-ს დააგდებდა.
const SORTABLE_COLUMNS = new Set(['id', 'title', 'sortOrder', 'createdAt']);

@Injectable()
export class BranchesService {
  constructor(
    @InjectRepository(Branch)
    private branchRepository: Repository<Branch>,
    @InjectRepository(ProductBranch)
    private productBranchRepository: Repository<ProductBranch>,
    private companiesService: CompaniesService,
  ) {}

  // checkout-ის "ფილიალიდან გატანა" სია — მხოლოდ აქტიური ფილიალები,
  // სურვილისამებრ კონკრეტული კომპანიით გაფილტრული.
  async findAllActive(
    dto: FindBranchesDto,
  ): Promise<PaginatedResponseDto<Branch>> {
    return this.findAllPaginated(dto, { isActive: true });
  }

  // ადმინის დეშბორდი დახურული ფილიალებსაც ხედავს.
  async findAllAdmin(
    dto: FindBranchesDto,
  ): Promise<PaginatedResponseDto<Branch>> {
    return this.findAllPaginated(dto, {});
  }

  private async findAllPaginated(
    dto: FindBranchesDto,
    extraWhere: Partial<Pick<Branch, 'isActive'>>,
  ): Promise<PaginatedResponseDto<Branch>> {
    const qb = this.branchRepository
      .createQueryBuilder('branch')
      .leftJoinAndSelect('branch.company', 'company');
    if (extraWhere.isActive !== undefined) {
      qb.andWhere('branch.isActive = :isActive', {
        isActive: extraWhere.isActive,
      });
    }
    if (dto.companyId) {
      qb.andWhere('branch.companyId = :companyId', {
        companyId: dto.companyId,
      });
    }
    return paginate(qb, 'branch', dto, SORTABLE_COLUMNS, 'sortOrder', {
      secondaryOrderBy: { column: 'branch.id', direction: 'ASC' },
    });
  }

  // საჯარო "ფილიალების გვერდი + რუკა" — ყველა აქტიური ფილიალი ერთბაშად,
  // pagination გარეშე (რუკაზე ყველა პინი ერთდროულად უნდა ჩანდეს, არა
  // გვერდობრივად 10-10).
  async findAllForMap(): Promise<Branch[]> {
    return this.branchRepository.find({
      where: { isActive: true },
      relations: { company: true },
      order: { sortOrder: 'ASC', id: 'ASC' },
    });
  }

  async findOne(id: number): Promise<Branch> {
    const branch = await this.branchRepository.findOne({
      where: { id },
      relations: { company: true },
    });
    if (!branch) {
      throw new NotFoundException(`ფილიალი ID-ით ${id} ვერ მოიძებნა`);
    }
    return branch;
  }

  async create(dto: CreateBranchDto): Promise<Branch> {
    await this.companiesService.findOne(dto.companyId, true); // შეამოწმებს, არსებობს თუ არა
    const branch = this.branchRepository.create(dto as Partial<Branch>);
    return this.branchRepository.save(branch);
  }

  async update(id: number, dto: UpdateBranchDto): Promise<Branch> {
    const branch = await this.findOne(id);
    if (dto.companyId !== undefined) {
      await this.companiesService.findOne(dto.companyId, true); // შეამოწმებს, არსებობს თუ არა
    }
    Object.assign(branch, dto);
    return this.branchRepository.save(branch);
  }

  async remove(id: number): Promise<void> {
    const branch = await this.findOne(id);
    await this.branchRepository.remove(branch);
  }

  // checkout-ის "ფილიალიდან გატანა" არჩევანი — აქტიური ფილიალები, სადაც
  // **ყველა** მოცემული პროდუქტისთვის არსებობს ProductBranch row stock > 0-ით
  // (კალათის ყველა item-ის ერთდროული ხელმისაწვდომობა). company relation-ი
  // ლოგოს საჩვენებლადაა ჩართული.
  async findAvailableForProducts(productIds: number[]): Promise<Branch[]> {
    if (productIds.length === 0) {
      return [];
    }

    const rows = await this.productBranchRepository
      .createQueryBuilder('pb')
      .select('pb.branchId', 'branchId')
      .where('pb.productId IN (:...productIds)', { productIds })
      .andWhere('pb.stock > 0')
      .groupBy('pb.branchId')
      .having('COUNT(DISTINCT pb.productId) = :count', {
        count: productIds.length,
      })
      .getRawMany<{ branchId: number }>();

    const branchIds = rows.map((r) => r.branchId);
    if (branchIds.length === 0) {
      return [];
    }

    return this.branchRepository.find({
      where: { id: In(branchIds), isActive: true },
      relations: { company: true },
      order: { sortOrder: 'ASC', id: 'ASC' },
    });
  }
}
