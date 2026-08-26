import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, TreeRepository } from 'typeorm';
import { Category } from './entities/category.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { FindCategoriesDto } from './dto/find-categories.dto';
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
