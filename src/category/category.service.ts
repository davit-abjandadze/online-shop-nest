import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, TreeRepository } from 'typeorm';
import { Category } from './entities/category.entity';
import { CategoryAttribute } from './entities/category-attribute.entity';
import { Attribute } from '../attribute/entities/attribute.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { FindCategoriesDto } from './dto/find-categories.dto';
import { AddCategoryAttributeDto } from './dto/add-category-attribute.dto';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';

// sortBy პარამეტრი პირდაპირ user-ისგან მოდის query string-იდან — SQL
// injection-ის თავიდან ასაცილებლად ვუშვებთ მხოლოდ ცნობილ სვეტებს
// (იხ. products.service.ts-ის იგივე პატერნი).
const SORTABLE_COLUMNS = new Set([
  'id',
  'nameKa',
  'nameEn',
  'slug',
  'sortOrder',
  'createdAt',
]);

@Injectable()
export class CategoryService {
  // closure-table ხის query-ებისთვის (findTrees/findDescendants) ჩვეულებრივი
  // Repository არ კმარა — TreeRepository იმავე connection-ის manager-იდან
  // ვიღებთ, ცალკე @InjectRepository(Category)-ის დუბლირების გარეშე.
  private readonly treeRepository: TreeRepository<Category>;

  constructor(
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
    @InjectRepository(CategoryAttribute)
    private categoryAttributeRepository: Repository<CategoryAttribute>,
    @InjectRepository(Attribute)
    private attributeRepository: Repository<Attribute>,
  ) {
    this.treeRepository =
      this.categoryRepository.manager.getTreeRepository(Category);
  }

  async findAllPaginated(
    findCategoriesDto: FindCategoriesDto,
  ): Promise<PaginatedResponseDto<Category>> {
    const {
      page = 1,
      limit = 10,
      sortBy = 'sortOrder',
      order = 'ASC',
      parentId,
    } = findCategoriesDto;

    const qb = this.categoryRepository
      .createQueryBuilder('category')
      .leftJoinAndSelect('category.parent', 'parent');

    if (parentId) {
      qb.andWhere('parent.id = :parentId', { parentId });
    }

    const sortColumn = SORTABLE_COLUMNS.has(sortBy) ? sortBy : 'sortOrder';
    qb.orderBy(`category.${sortColumn}`, order === 'DESC' ? 'DESC' : 'ASC');
    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();
    return new PaginatedResponseDto(data, total, page, limit);
  }

  // სრული nested ხე — root-ებიდან დაწყებული, ჩაშენებული children[]-ებით.
  async findTree(): Promise<Category[]> {
    return this.treeRepository.findTrees();
  }

  async findOne(id: string): Promise<Category> {
    const category = await this.categoryRepository.findOne({
      where: { id },
      relations: { parent: true },
    });
    if (!category) {
      throw new NotFoundException(`კატეგორია ID-ით ${id} ვერ მოიძებნა`);
    }
    return category;
  }

  async findBySlug(slug: string): Promise<Category> {
    const category = await this.categoryRepository.findOne({
      where: { slug },
      relations: { parent: true },
    });
    if (!category) {
      throw new NotFoundException(`კატეგორია slug-ით "${slug}" ვერ მოიძებნა`);
    }
    return category;
  }

  async create(createCategoryDto: CreateCategoryDto): Promise<Category> {
    await this.ensureSlugIsFree(createCategoryDto.slug);

    const { parentId, ...rest } = createCategoryDto;
    const category = this.categoryRepository.create({
      ...rest,
      ...(parentId ? { parent: await this.findOne(parentId) } : {}),
    });
    return this.categoryRepository.save(category);
  }

  async update(
    id: string,
    updateCategoryDto: UpdateCategoryDto,
  ): Promise<Category> {
    const category = await this.findOne(id); // შეამოწმებს, არსებობს თუ არა

    if (updateCategoryDto.slug && updateCategoryDto.slug !== category.slug) {
      await this.ensureSlugIsFree(updateCategoryDto.slug);
    }

    const { parentId, ...rest } = updateCategoryDto;
    Object.assign(category, rest);

    if (parentId !== undefined) {
      if (parentId === id) {
        throw new BadRequestException(
          'კატეგორია ვერ გახდება საკუთარი თავის მშობელი',
        );
      }
      await this.assertNotDescendant(id, parentId);
      category.parent = await this.findOne(parentId);
    }

    return this.categoryRepository.save(category);
  }

  async remove(id: string): Promise<Category> {
    const category = await this.findOne(id);

    // countDescendants თვლის თავად category-საც +1-ად, ამიტომ >1 ნიშნავს,
    // რომ ერთი მაინც შვილი კატეგორია არსებობს.
    const descendantsCount =
      await this.treeRepository.countDescendants(category);
    if (descendantsCount > 1) {
      throw new ConflictException(
        'კატეგორიის წაშლა შეუძლებელია — ჯერ წაშალეთ ან გადაანაცვლეთ შვილი კატეგორიები',
      );
    }

    const linkedProducts = await this.categoryRepository
      .createQueryBuilder('category')
      .innerJoin('category.products', 'product')
      .where('category.id = :id', { id })
      .getCount();
    if (linkedProducts > 0) {
      throw new ConflictException(
        'კატეგორიის წაშლა შეუძლებელია — მასზე მიბმულია პროდუქტები',
      );
    }

    return this.categoryRepository.remove(category);
  }

  // ამ კატეგორიის attribute set — საკუთარი category_attribute row-ები +
  // ყველა წინაპრისგან (root-მდე) მემკვიდრეობით მიღებული, დუბლირების
  // გარეშე. თუ იგივე attributeId-ზე საკუთარი და წინაპრის row ერთდროულად
  // არსებობს, საკუთარი (ამ კატეგორიის) ყოველთვის იმარჯვებს.
  async findAttributesForCategory(
    categoryId: string,
  ): Promise<CategoryAttribute[]> {
    const category = await this.findOne(categoryId); // შეამოწმებს, არსებობს თუ არა

    // TypeORM-ის findAncestors თავად category-საც აბრუნებს წინაპრებთან ერთად.
    const ancestors = await this.treeRepository.findAncestors(category);
    const ancestorIds = ancestors.map((c) => c.id);

    const rows = await this.categoryAttributeRepository.find({
      where: { categoryId: In(ancestorIds) },
      relations: { attribute: { options: true } },
    });

    const byAttributeId = new Map<string, CategoryAttribute>();
    for (const row of rows) {
      const existing = byAttributeId.get(row.attributeId);
      // საკუთარი კატეგორიის row ყოველთვის გადაწერს წინაპრისგან
      // მემკვიდრეობით მიღებულს, დამუშავების რიგის მიუხედავად.
      if (!existing || row.categoryId === categoryId) {
        byAttributeId.set(row.attributeId, row);
      }
    }

    return Array.from(byAttributeId.values()).sort(
      (a, b) => a.sortOrder - b.sortOrder,
    );
  }

  async addAttributeToCategory(
    categoryId: string,
    addCategoryAttributeDto: AddCategoryAttributeDto,
  ): Promise<CategoryAttribute> {
    await this.findOne(categoryId); // შეამოწმებს, არსებობს თუ არა

    const attribute = await this.attributeRepository.findOne({
      where: { id: addCategoryAttributeDto.attributeId },
    });
    if (!attribute) {
      throw new NotFoundException(
        `მახასიათებელი ID-ით ${addCategoryAttributeDto.attributeId} ვერ მოიძებნა`,
      );
    }

    const existing = await this.categoryAttributeRepository.findOne({
      where: { categoryId, attributeId: addCategoryAttributeDto.attributeId },
    });
    if (existing) {
      throw new ConflictException(
        'ეს მახასიათებელი უკვე მიბმულია ამ კატეგორიაზე',
      );
    }

    const categoryAttribute = this.categoryAttributeRepository.create({
      categoryId,
      attributeId: addCategoryAttributeDto.attributeId,
      sortOrder: addCategoryAttributeDto.sortOrder ?? 0,
      isRequiredOverride: addCategoryAttributeDto.isRequiredOverride ?? null,
    });
    return this.categoryAttributeRepository.save(categoryAttribute);
  }

  async removeAttributeFromCategory(
    categoryId: string,
    attributeId: string,
  ): Promise<CategoryAttribute> {
    const categoryAttribute = await this.categoryAttributeRepository.findOne({
      where: { categoryId, attributeId },
    });
    if (!categoryAttribute) {
      throw new NotFoundException(
        'ეს მახასიათებელი მიბმული არ არის ამ კატეგორიაზე (პირდაპირ — მემკვიდრეობით მიღებული ვერ მოიხსნება ცალკე)',
      );
    }
    return this.categoryAttributeRepository.remove(categoryAttribute);
  }

  private async ensureSlugIsFree(slug: string): Promise<void> {
    const existing = await this.categoryRepository.findOne({
      where: { slug },
    });
    if (existing) {
      throw new ConflictException(
        `კატეგორია ამ slug-ით ("${slug}") უკვე არსებობს`,
      );
    }
  }

  // parentId ვერ იქნება id-ის შთამომავალი, თორემ ხე წრეზე შეიკვრება.
  private async assertNotDescendant(
    id: string,
    parentId: string,
  ): Promise<void> {
    const subject = await this.findOne(id);
    const descendants = await this.treeRepository.findDescendants(subject);
    if (descendants.some((d) => d.id === parentId)) {
      throw new BadRequestException(
        'მშობლად ვერ აირჩევა კატეგორიის საკუთარი შთამომავალი — ხე წრეზე შეიკვრება',
      );
    }
  }
}
