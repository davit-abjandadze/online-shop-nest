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

// findAvailableForProducts-ის შესატანი ერთი კალათის item — variantId/colorId
// ორივე optional-ია (ProductBranch entity-ის იგივე flat/variant/color
// დაყოფა), მაგრამ ერთდროულად ორივე არასდროს არ მოდის ერთი კალათის item-იდან
// (CartItem.variantId/colorId-იც ურთიერთგამომრიცხავია).
export interface BranchAvailabilityItem {
  productId: number;
  variantId?: string;
  colorId?: string;
}

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
  // **ყველა** მოცემული კალათის item-ისთვის (productId + სურვილისამებრ
  // კონკრეტული variantId/colorId) არსებობს ProductBranch row stock > 0-ით
  // (კალათის ყველა item-ის ერთდროული ხელმისაწვდომობა ერთსა და იმავე
  // ფილიალში). item-ს variantId/colorId რომ არ ჰქონდეს მითითებული, "flat"
  // (variantId IS NULL AND colorId IS NULL) row ეძებნება — ProductBranch
  // entity-ის იგივე სამნაწილიანი დაყოფა (flat/variant/color). company
  // relation-ი ლოგოს საჩვენებლადაა ჩართული.
  //
  // items-ის რაოდენობა (და არა DISTINCT productId) ცალკეულ item-ებად
  // ითვლება ერთ UNION ALL query-ში — ერთსა და იმავე productId-ს კალათაში
  // შეიძლება ჰქონდეს რამდენიმე item სხვადასხვა ვარიანტით/ფერით, თითოეული
  // ცალკე უნდა დაკმაყოფილდეს იმავე ფილიალში.
  async findAvailableForProducts(
    items: BranchAvailabilityItem[],
  ): Promise<Branch[]> {
    if (items.length === 0) {
      return [];
    }

    const unionParts: string[] = [];
    const params: (number | string)[] = [];
    items.forEach((item, index) => {
      const conditions = [`pb."productId" = $${params.length + 1}`];
      params.push(item.productId);
      if (item.variantId) {
        conditions.push(`pb."variantId" = $${params.length + 1}`);
        params.push(item.variantId);
      } else if (item.colorId) {
        conditions.push(`pb."colorId" = $${params.length + 1}`);
        params.push(item.colorId);
      } else {
        conditions.push(`pb."variantId" IS NULL AND pb."colorId" IS NULL`);
      }
      unionParts.push(
        `SELECT pb."branchId" AS "branchId", ${index} AS "itemIndex" FROM product_branch pb WHERE ${conditions.join(' AND ')} AND pb.stock > 0`,
      );
    });

    const countParamIndex = params.length + 1;
    params.push(items.length);
    const sql = `
      SELECT "branchId" FROM (${unionParts.join(' UNION ALL ')}) matches
      GROUP BY "branchId"
      HAVING COUNT(DISTINCT "itemIndex") = $${countParamIndex}
    `;

    const rows: { branchId: number }[] =
      await this.productBranchRepository.query(sql, params);

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
