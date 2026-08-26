import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { ProductAttributeValue } from './entities/product-attribute-value.entity';
import { Category } from '../category/entities/category.entity';
import {
  Attribute,
  AttributeType,
} from '../attribute/entities/attribute.entity';
import { CategoryService } from '../category/category.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { SearchProductDto } from './dto/search-product.dto';
import { SetProductAttributeValuesDto } from './dto/set-product-attribute-values.dto';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';

// sortBy პარამეტრი პირდაპირ user-ისგან მოდის query string-იდან — SQL
// injection-ის თავიდან ასაცილებლად ვუშვებთ მხოლოდ ცნობილ სვეტებს
// (იხ. users.service.ts-ის იგივე პატერნი).
const SORTABLE_COLUMNS = new Set([
  'id',
  'name',
  'price',
  'stock',
  'isActive',
  'createdAt',
]);

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @InjectRepository(ProductAttributeValue)
    private productAttributeValueRepository: Repository<ProductAttributeValue>,
    private readonly categoryService: CategoryService,
  ) {}

  async findAllPaginated(
    searchProductDto: SearchProductDto,
  ): Promise<PaginatedResponseDto<Product>> {
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      order = 'DESC',
      search,
      categoryId,
      minPrice,
      maxPrice,
      isActive,
    } = searchProductDto;

    const qb = this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category');

    if (search) {
      qb.andWhere(
        '(product.name ILIKE :search OR product.description ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (categoryId) {
      qb.andWhere('category.id = :categoryId', { categoryId });
    }

    if (minPrice !== undefined) {
      qb.andWhere('product.price >= :minPrice', { minPrice });
    }

    if (maxPrice !== undefined) {
      qb.andWhere('product.price <= :maxPrice', { maxPrice });
    }

    if (isActive !== undefined) {
      qb.andWhere('product.isActive = :isActive', { isActive });
    }

    const sortColumn = SORTABLE_COLUMNS.has(sortBy) ? sortBy : 'createdAt';
    qb.orderBy(`product.${sortColumn}`, order === 'ASC' ? 'ASC' : 'DESC');

    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return new PaginatedResponseDto(data, total, page, limit);
  }

  async findOne(id: number) {
    const product = await this.productRepository.findOne({
      where: { id },
      relations: { category: true },
    });
    if (!product) {
      throw new NotFoundException(`პროდუქტი ID-ით ${id} ვერ მოიძებნა`);
    }
    return product;
  }

  async create(createProductDto: CreateProductDto) {
    const { categoryId, price, ...rest } = createProductDto;
    const product = this.productRepository.create({
      ...rest,
      price: price.toString(),
      ...(categoryId !== undefined ? { category: { id: categoryId } } : {}),
    });
    return this.productRepository.save(product);
  }

  async update(id: number, updateProductDto: UpdateProductDto) {
    const product = await this.findOne(id); // შეამოწმებს, არსებობს თუ არა
    const { categoryId, price, ...rest } = updateProductDto;
    Object.assign(product, rest);
    if (price !== undefined) {
      product.price = price.toString();
    }
    if (categoryId !== undefined) {
      product.category = { id: categoryId } as Category;
    }
    return this.productRepository.save(product);
  }

  async remove(id: number) {
    const product = await this.findOne(id);
    return this.productRepository.remove(product);
  }

  // --- Attribute values (ფაზა 4: Product ↔ Attribute value) -------------

  async getAttributeValues(
    productId: number,
  ): Promise<ProductAttributeValue[]> {
    await this.findOne(productId); // შეამოწმებს, არსებობს თუ არა
    return this.productAttributeValueRepository.find({
      where: { productId },
      relations: { attribute: true, attributeOption: true },
    });
  }

  // bulk set — მოცემული DTO მასივი მთლიანად ანაცვლებს ამ პროდუქტის
  // არსებულ attribute value-ებს (delete + recreate). წინასწარ ვამოწმებთ
  // DTO-ს პროდუქტის კატეგორიის ეფექტურ attribute set-თან (CategoryService.
  // findAttributesForCategory — მემკვიდრეობის ჩათვლით): უცნობი attributeId
  // უარყოფილია, სავალდებულო attribute-ების გამოტოვება — ასევე, attribute.type-ის
  // შესაბამისი value-ველის (attributeOptionId/valueText/valueNumber/
  // valueBoolean) გამოტოვება ან option-ის სხვა attribute-ს კუთვნილება.
  async setAttributeValues(
    productId: number,
    setProductAttributeValuesDto: SetProductAttributeValuesDto,
  ): Promise<ProductAttributeValue[]> {
    const product = await this.findOne(productId); // შეამოწმებს, არსებობს თუ არა
    if (!product.category) {
      throw new BadRequestException(
        'პროდუქტს არ აქვს კატეგორია მიბმული — ჯერ დაამატეთ კატეგორია',
      );
    }

    const categoryAttributes =
      await this.categoryService.findAttributesForCategory(product.category.id);
    const byAttributeId = new Map(
      categoryAttributes.map((ca) => [ca.attributeId, ca]),
    );

    const providedAttributeIds = new Set(
      setProductAttributeValuesDto.values.map((v) => v.attributeId),
    );
    for (const ca of categoryAttributes) {
      const isRequired = ca.isRequiredOverride ?? ca.attribute.isRequired;
      if (isRequired && !providedAttributeIds.has(ca.attributeId)) {
        throw new BadRequestException(
          `მახასიათებელი "${ca.attribute.nameKa}" სავალდებულოა ამ კატეგორიისთვის`,
        );
      }
    }

    const rows: Partial<ProductAttributeValue>[] = [];
    for (const item of setProductAttributeValuesDto.values) {
      const categoryAttribute = byAttributeId.get(item.attributeId);
      if (!categoryAttribute) {
        throw new BadRequestException(
          `მახასიათებელი ID-ით ${item.attributeId} არ შედის ამ პროდუქტის კატეგორიის attribute set-ში`,
        );
      }
      const attribute = categoryAttribute.attribute;

      switch (attribute.type) {
        case AttributeType.SELECT: {
          if (!item.attributeOptionId) {
            throw new BadRequestException(
              `მახასიათებელი "${attribute.nameKa}" საჭიროებს attributeOptionId-ს`,
            );
          }
          this.assertOptionBelongsToAttribute(
            attribute,
            item.attributeOptionId,
          );
          rows.push({
            productId,
            attributeId: attribute.id,
            attributeOptionId: item.attributeOptionId,
          });
          break;
        }
        case AttributeType.MULTI_SELECT: {
          if (!item.attributeOptionIds?.length) {
            throw new BadRequestException(
              `მახასიათებელი "${attribute.nameKa}" საჭიროებს attributeOptionIds-ს`,
            );
          }
          for (const optionId of item.attributeOptionIds) {
            this.assertOptionBelongsToAttribute(attribute, optionId);
            rows.push({
              productId,
              attributeId: attribute.id,
              attributeOptionId: optionId,
            });
          }
          break;
        }
        case AttributeType.NUMBER:
        case AttributeType.RANGE: {
          if (item.valueNumber === undefined) {
            throw new BadRequestException(
              `მახასიათებელი "${attribute.nameKa}" საჭიროებს valueNumber-ს`,
            );
          }
          rows.push({
            productId,
            attributeId: attribute.id,
            valueNumber: item.valueNumber.toString(),
          });
          break;
        }
        case AttributeType.BOOLEAN: {
          if (item.valueBoolean === undefined) {
            throw new BadRequestException(
              `მახასიათებელი "${attribute.nameKa}" საჭიროებს valueBoolean-ს`,
            );
          }
          rows.push({
            productId,
            attributeId: attribute.id,
            valueBoolean: item.valueBoolean,
          });
          break;
        }
        case AttributeType.TEXT:
        default: {
          if (!item.valueText) {
            throw new BadRequestException(
              `მახასიათებელი "${attribute.nameKa}" საჭიროებს valueText-ს`,
            );
          }
          rows.push({
            productId,
            attributeId: attribute.id,
            valueText: item.valueText,
          });
          break;
        }
      }
    }

    await this.productAttributeValueRepository.delete({ productId });
    if (rows.length === 0) {
      return [];
    }
    const entities = rows.map((row) =>
      this.productAttributeValueRepository.create(row),
    );
    return this.productAttributeValueRepository.save(entities);
  }

  private assertOptionBelongsToAttribute(
    attribute: Attribute,
    optionId: string,
  ): void {
    const belongs = attribute.options?.some((option) => option.id === optionId);
    if (!belongs) {
      throw new BadRequestException(
        `option ID-ით ${optionId} არ ეკუთვნის მახასიათებელს "${attribute.nameKa}"`,
      );
    }
  }
}
