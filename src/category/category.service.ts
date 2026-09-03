import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, SelectQueryBuilder, TreeRepository } from 'typeorm';
import { Category } from './entities/category.entity';
import { CategoryAttribute } from './entities/category-attribute.entity';
import {
  Attribute,
  AttributeType,
} from '../attribute/entities/attribute.entity';
import { AttributeOption } from '../attribute/entities/attribute-option.entity';
import { Product } from '../products/entities/product.entity';
import { ProductAttributeValue } from '../products/entities/product-attribute-value.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { FindCategoriesDto } from './dto/find-categories.dto';
import { AddCategoryAttributeDto } from './dto/add-category-attribute.dto';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { resolveTranslation } from '../common/utils/resolve-translation.util';
import { mergeTranslations } from '../common/utils/merge-translations.util';
import { Locale } from '../common/types/translations.type';

// sortBy პარამეტრი პირდაპირ user-ისგან მოდის query string-იდან — SQL
// injection-ის თავიდან ასაცილებლად ვუშვებთ მხოლოდ ცნობილ სვეტებს
// (იხ. products.service.ts-ის იგივე პატერნი). `nameKa`/`nameEn` აღარ
// არსებობს flat სვეტად (JSONB translations-შია გადატანილი) — დალაგება
// მასზე აღარაა მხარდაჭერილი, უცნობი sortBy default-ზე (sortOrder) გადავა.
const SORTABLE_COLUMNS = new Set(['id', 'slug', 'sortOrder', 'createdAt']);

// `GET /categories/:slug/products`-ზე დაშვებული დალაგების სვეტები — მხოლოდ
// product-ის საკუთარი სვეტები, attribute value-ით დალაგება scope-ს გარეთაა.
const PRODUCT_SORTABLE_COLUMNS = new Set([
  'id',
  'name',
  'price',
  'stock',
  'createdAt',
]);

// ფაზა 5-ის filter/facet endpoint-ებში query params raw სახით მოდის
// (`ValidationPipe`-ის whitelist-ს ავუვლით — attribute-ის კოდები წინასწარ
// უცნობია, DTO-თი ვერ აღიწერება), ამიტომ ტიპი მარტივი string-map-ია.
export type CategoryFiltersQuery = Record<string, string>;

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
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @InjectRepository(ProductAttributeValue)
    private productAttributeValueRepository: Repository<ProductAttributeValue>,
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

    // per-locale deep-merge Object.assign-მდე — თუ ადმინი მხოლოდ ერთი
    // locale-ის translations გამოაგზავნა (მაგ. { en: {...} }), დანარჩენი
    // locale-ები (ka/ru) არ უნდა წაიშალოს (იხ. mergeTranslations).
    const { parentId, translations, ...rest } = updateCategoryDto;
    Object.assign(category, rest);
    if (translations) {
      category.translations = mergeTranslations(
        category.translations,
        translations,
      )!;
    }

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

  // --- Filter / facet (ფაზა 5) --------------------------------------------

  // `?subcategory=slug` — თუ მოცემულია, ბაზურ კატეგორიას (slug URL-იდან)
  // ცვლის მისი შვილი კატეგორიით (მისივე subtree-ით); slug-ს უნდა ეკუთვნოდეს
  // ბაზური კატეგორიის subtree-ს, თორემ 400/404.
  private async getSubtreeCategoryIds(
    baseCategory: Category,
    query: CategoryFiltersQuery,
  ): Promise<string[]> {
    let root = baseCategory;

    if (query.subcategory) {
      const sub = await this.categoryRepository.findOne({
        where: { slug: query.subcategory },
      });
      if (!sub) {
        throw new NotFoundException(
          `ქვეკატეგორია slug-ით "${query.subcategory}" ვერ მოიძებნა`,
        );
      }
      const baseDescendants =
        await this.treeRepository.findDescendants(baseCategory);
      if (!baseDescendants.some((d) => d.id === sub.id)) {
        throw new BadRequestException(
          `კატეგორია "${query.subcategory}" არ არის "${baseCategory.slug}"-ის ქვეკატეგორია`,
        );
      }
      root = sub;
    }

    const descendants = await this.treeRepository.findDescendants(root);
    return descendants.map((d) => d.id);
  }

  // `categoryIds` subtree-ს (+ ბაზური კატეგორიის წინაპრების) ფარგლებში
  // ერთხელ მიბმული ყველა `isFilterable` attribute, დუბლირების გარეშე —
  // findAttributesForCategory-სგან განსხვავებით, აქ "საკუთარი overrides
  // წინაპარს"-ის მემკვიდრეობის ლოგიკა საჭირო არაა (მხოლოდ union გვინდა
  // ფილტრების სიისთვის), ამიტომ ცალკე, მარტივი მეთოდია.
  private async getEffectiveFilterableAttributes(
    baseCategory: Category,
    categoryIds: string[],
  ): Promise<Attribute[]> {
    const ancestors = await this.treeRepository.findAncestors(baseCategory);
    const scopeIds = Array.from(
      new Set([...ancestors.map((a) => a.id), ...categoryIds]),
    );

    const rows = await this.categoryAttributeRepository.find({
      where: { categoryId: In(scopeIds) },
      relations: { attribute: { options: true } },
    });

    const byAttributeId = new Map<string, Attribute>();
    for (const row of rows) {
      if (row.attribute.isFilterable) {
        byAttributeId.set(row.attributeId, row.attribute);
      }
    }
    return Array.from(byAttributeId.values()).sort(
      (a, b) => a.sortOrder - b.sortOrder,
    );
  }

  // ბაზური querybuilder — `categoryIds` subtree + search/price + attribute
  // ფილტრები (`attributesByCode`-ში არსებული attribute-ის კოდზე დამთხვეული
  // query key-ებით). `excludeAttributeCode` faceted count-ისთვისაა —
  // საკუთარ attribute-ზე ფილტრს არ ვიყენებთ, რომ იმავე attribute-ის სხვა
  // option-ების count-ებიც გამოჩნდეს (და არა მხოლოდ უკვე არჩეულის).
  private buildFilteredProductsQuery(
    categoryIds: string[],
    query: CategoryFiltersQuery,
    attributesByCode: Map<string, Attribute>,
    excludeAttributeCode?: string,
  ): SelectQueryBuilder<Product> {
    const qb = this.productRepository
      .createQueryBuilder('product')
      .innerJoinAndSelect('product.category', 'category')
      .where('category.id IN (:...categoryIds)', { categoryIds })
      .andWhere('product.isActive = true')
      .distinct(true);

    if (query.search) {
      // name/description აღარაა flat სვეტები — ნებისმიერ locale-ში
      // დამთხვევაზე ვეძებთ (ka/en/ru), lenient-ად, JSONB ->> ოპერატორით.
      qb.andWhere(
        `(
          product.translations -> 'ka' ->> 'name' ILIKE :search
          OR product.translations -> 'en' ->> 'name' ILIKE :search
          OR product.translations -> 'ru' ->> 'name' ILIKE :search
          OR product.translations -> 'ka' ->> 'description' ILIKE :search
          OR product.translations -> 'en' ->> 'description' ILIKE :search
          OR product.translations -> 'ru' ->> 'description' ILIKE :search
        )`,
        { search: `%${query.search}%` },
      );
    }
    if (query.minPrice !== undefined) {
      qb.andWhere('product.price >= :minPrice', {
        minPrice: Number(query.minPrice),
      });
    }
    if (query.maxPrice !== undefined) {
      qb.andWhere('product.price <= :maxPrice', {
        maxPrice: Number(query.maxPrice),
      });
    }

    let joinIndex = 0;
    for (const [code, attribute] of attributesByCode) {
      if (code === excludeAttributeCode) {
        continue;
      }
      const alias = `pav_${joinIndex++}`;

      switch (attribute.type) {
        case AttributeType.SELECT:
        case AttributeType.MULTI_SELECT: {
          const raw = query[code];
          if (!raw) {
            continue;
          }
          const optionCodes = raw
            .split(',')
            .map((c) => c.trim())
            .filter(Boolean);
          const optionIds = (attribute.options ?? [])
            .filter((o) => optionCodes.includes(o.code))
            .map((o) => o.id);
          if (!optionIds.length) {
            // მოთხოვნილი option-კოდები ამ attribute-ს არცერთი არ ეკუთვნის —
            // შედეგი ცალსახად ცარიელია.
            qb.andWhere('1 = 0');
            continue;
          }
          qb.innerJoin(
            ProductAttributeValue,
            alias,
            `${alias}.productId = product.id AND ${alias}.attributeId = :${alias}AttrId AND ${alias}.attributeOptionId IN (:...${alias}OptIds)`,
            { [`${alias}AttrId`]: attribute.id, [`${alias}OptIds`]: optionIds },
          );
          break;
        }
        case AttributeType.NUMBER:
        case AttributeType.RANGE: {
          const min = query[`${code}_min`];
          const max = query[`${code}_max`];
          if (min === undefined && max === undefined) {
            continue;
          }
          qb.innerJoin(
            ProductAttributeValue,
            alias,
            `${alias}.productId = product.id AND ${alias}.attributeId = :${alias}AttrId`,
            { [`${alias}AttrId`]: attribute.id },
          );
          if (min !== undefined) {
            qb.andWhere(`${alias}.valueNumber >= :${alias}Min`, {
              [`${alias}Min`]: Number(min),
            });
          }
          if (max !== undefined) {
            qb.andWhere(`${alias}.valueNumber <= :${alias}Max`, {
              [`${alias}Max`]: Number(max),
            });
          }
          break;
        }
        case AttributeType.BOOLEAN: {
          const raw = query[code];
          if (raw === undefined) {
            continue;
          }
          qb.innerJoin(
            ProductAttributeValue,
            alias,
            `${alias}.productId = product.id AND ${alias}.attributeId = :${alias}AttrId`,
            { [`${alias}AttrId`]: attribute.id },
          ).andWhere(`${alias}.valueBoolean = :${alias}Val`, {
            [`${alias}Val`]: raw === 'true',
          });
          break;
        }
        case AttributeType.TEXT:
        default: {
          const raw = query[code];
          if (raw === undefined) {
            continue;
          }
          qb.innerJoin(
            ProductAttributeValue,
            alias,
            `${alias}.productId = product.id AND ${alias}.attributeId = :${alias}AttrId`,
            { [`${alias}AttrId`]: attribute.id },
          ).andWhere(`${alias}.valueText ILIKE :${alias}Val`, {
            [`${alias}Val`]: `%${raw}%`,
          });
          break;
        }
      }
    }

    return qb;
  }

  private static parsePositiveInt(
    value: string | undefined,
    fallback: number,
  ): number {
    const parsed = value !== undefined ? parseInt(value, 10) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }

  // `GET /categories/:slug/filters` — ამ (+ ქვეკატეგორიების) subtree-ში
  // მიბმული ყველა `isFilterable` attribute, options-ითურთ, faceted
  // count-ებით (`ProductAttributeValue`-ზე group-ით), მიმდინარე query-ის
  // სხვა (ამ attribute-ის გარდა) აქტიური ფილტრების გათვალისწინებით.
  async getFilters(
    slug: string,
    query: CategoryFiltersQuery,
    locale: Locale = 'ka',
  ) {
    const category = await this.findBySlug(slug);
    const categoryIds = await this.getSubtreeCategoryIds(category, query);
    const attributes = await this.getEffectiveFilterableAttributes(
      category,
      categoryIds,
    );
    const attributesByCode = new Map(attributes.map((a) => [a.code, a]));

    const results: Array<{
      attribute: {
        id: string;
        name: string | undefined;
        translations: Attribute['translations'];
        code: string;
        type: Attribute['type'];
        unit?: string;
      };
      options?: Array<{
        id: string;
        value: string | undefined;
        translations: AttributeOption['translations'];
        code: string;
        count: number;
      }>;
      min?: number | null;
      max?: number | null;
      counts?: { true: number; false: number };
    }> = [];

    for (const attribute of attributes) {
      const attributeSummary = {
        id: attribute.id,
        name: resolveTranslation(attribute.translations, locale)?.name,
        translations: attribute.translations,
        code: attribute.code,
        type: attribute.type,
        unit: attribute.unit,
      };
      const baseQb = this.buildFilteredProductsQuery(
        categoryIds,
        query,
        attributesByCode,
        attribute.code,
      );

      if (
        attribute.type === AttributeType.SELECT ||
        attribute.type === AttributeType.MULTI_SELECT
      ) {
        const raw = await baseQb
          .clone()
          .innerJoin(
            ProductAttributeValue,
            'facet',
            'facet.productId = product.id AND facet.attributeId = :facetAttrId',
            { facetAttrId: attribute.id },
          )
          .select('facet.attributeOptionId', 'optionId')
          .addSelect('COUNT(DISTINCT product.id)', 'count')
          .groupBy('facet.attributeOptionId')
          .getRawMany<{ optionId: string; count: string }>();
        const countByOption = new Map(
          raw.map((r) => [r.optionId, Number(r.count)]),
        );
        results.push({
          attribute: attributeSummary,
          options: (attribute.options ?? [])
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((o) => ({
              id: o.id,
              value: resolveTranslation(o.translations, locale)?.value,
              translations: o.translations,
              code: o.code,
              count: countByOption.get(o.id) ?? 0,
            })),
        });
      } else if (
        attribute.type === AttributeType.NUMBER ||
        attribute.type === AttributeType.RANGE
      ) {
        const stats = await baseQb
          .clone()
          .innerJoin(
            ProductAttributeValue,
            'facet',
            'facet.productId = product.id AND facet.attributeId = :facetAttrId',
            { facetAttrId: attribute.id },
          )
          .select('MIN(facet.valueNumber)', 'min')
          .addSelect('MAX(facet.valueNumber)', 'max')
          .getRawOne<{ min: string | null; max: string | null }>();
        results.push({
          attribute: attributeSummary,
          min:
            stats?.min !== null && stats?.min !== undefined
              ? Number(stats.min)
              : null,
          max:
            stats?.max !== null && stats?.max !== undefined
              ? Number(stats.max)
              : null,
        });
      } else if (attribute.type === AttributeType.BOOLEAN) {
        const raw = await baseQb
          .clone()
          .innerJoin(
            ProductAttributeValue,
            'facet',
            'facet.productId = product.id AND facet.attributeId = :facetAttrId',
            { facetAttrId: attribute.id },
          )
          .select('facet.valueBoolean', 'value')
          .addSelect('COUNT(DISTINCT product.id)', 'count')
          .groupBy('facet.valueBoolean')
          .getRawMany<{ value: boolean; count: string }>();
        const trueCount = raw.find((r) => r.value === true)?.count;
        const falseCount = raw.find((r) => r.value === false)?.count;
        results.push({
          attribute: attributeSummary,
          counts: {
            true: trueCount !== undefined ? Number(trueCount) : 0,
            false: falseCount !== undefined ? Number(falseCount) : 0,
          },
        });
      } else {
        // text — ფილტრის სიაში ჩანს, faceted count-ის გარეშე.
        results.push({ attribute: attributeSummary });
      }
    }

    return results;
  }

  // `GET /categories/:slug/products` — filtered + paginated products,
  // buildFilteredProductsQuery-ის იმავე attribute/search/price ლოგიკით.
  async getProductsForCategory(
    slug: string,
    query: CategoryFiltersQuery,
  ): Promise<PaginatedResponseDto<Product>> {
    const category = await this.findBySlug(slug);
    const categoryIds = await this.getSubtreeCategoryIds(category, query);
    const attributes = await this.getEffectiveFilterableAttributes(
      category,
      categoryIds,
    );
    const attributesByCode = new Map(attributes.map((a) => [a.code, a]));

    const page = CategoryService.parsePositiveInt(query.page, 1);
    const limit = Math.min(
      CategoryService.parsePositiveInt(query.limit, 10),
      100,
    );
    const sortColumn = PRODUCT_SORTABLE_COLUMNS.has(query.sortBy)
      ? query.sortBy
      : 'createdAt';
    const order = query.order === 'ASC' ? 'ASC' : 'DESC';

    const qb = this.buildFilteredProductsQuery(
      categoryIds,
      query,
      attributesByCode,
    );
    qb.orderBy(`product.${sortColumn}`, order);
    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();
    return new PaginatedResponseDto(data, total, page, limit);
  }
}
