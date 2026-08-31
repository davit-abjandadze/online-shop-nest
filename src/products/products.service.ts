import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { ProductAttributeValue } from './entities/product-attribute-value.entity';
import { ProductAdditionalInfo } from './entities/product-additional-info.entity';
import { ProductColor } from './entities/product-color.entity';
import { ProductBranch } from './entities/product-branch.entity';
import { Category } from '../category/entities/category.entity';
import { Company } from '../companies/entities/company.entity';
import { Branch } from '../branches/entities/branch.entity';
import {
  Attribute,
  AttributeType,
} from '../attribute/entities/attribute.entity';
import { Color } from '../colors/entities/color.entity';
import { CategoryService } from '../category/category.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { SearchProductDto } from './dto/search-product.dto';
import { SetProductAttributeValuesDto } from './dto/set-product-attribute-values.dto';
import { CreateProductAdditionalInfoDto } from './dto/create-product-additional-info.dto';
import { UpdateProductAdditionalInfoDto } from './dto/update-product-additional-info.dto';
import { SetProductColorsDto } from './dto/set-product-colors.dto';
import { SetProductBranchesDto } from './dto/set-product-branches.dto';
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
    @InjectRepository(ProductAdditionalInfo)
    private productAdditionalInfoRepository: Repository<ProductAdditionalInfo>,
    @InjectRepository(ProductColor)
    private productColorRepository: Repository<ProductColor>,
    @InjectRepository(ProductBranch)
    private productBranchRepository: Repository<ProductBranch>,
    @InjectRepository(Color)
    private colorRepository: Repository<Color>,
    @InjectRepository(Company)
    private companyRepository: Repository<Company>,
    @InjectRepository(Branch)
    private branchRepository: Repository<Branch>,
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
      hasDiscount,
      discountPercent,
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

    if (hasDiscount === true) {
      qb.andWhere(
        'product.discountPercent IS NOT NULL AND product.discountPercent > 0',
      );
    } else if (hasDiscount === false) {
      qb.andWhere(
        '(product.discountPercent IS NULL OR product.discountPercent = 0)',
      );
    }

    if (discountPercent !== undefined) {
      qb.andWhere('product.discountPercent = :discountPercent', {
        discountPercent,
      });
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
    const { categoryId, companyId, price, weight, length, width, ...rest } =
      createProductDto;
    await this.assertCompanyExists(companyId);
    const product = this.productRepository.create({
      ...rest,
      price: price.toString(),
      ...(weight !== undefined ? { weight: weight.toString() } : {}),
      ...(length !== undefined ? { length: length.toString() } : {}),
      ...(width !== undefined ? { width: width.toString() } : {}),
      ...(categoryId !== undefined ? { category: { id: categoryId } } : {}),
      company: { id: companyId } as Company,
    });
    return this.productRepository.save(product);
  }

  async update(id: number, updateProductDto: UpdateProductDto) {
    const product = await this.findOne(id); // შეამოწმებს, არსებობს თუ არა
    const { categoryId, companyId, price, weight, length, width, ...rest } =
      updateProductDto;
    Object.assign(product, rest);
    if (price !== undefined) {
      product.price = price.toString();
    }
    if (weight !== undefined) {
      product.weight = weight.toString();
    }
    if (length !== undefined) {
      product.length = length.toString();
    }
    if (width !== undefined) {
      product.width = width.toString();
    }
    if (categoryId !== undefined) {
      product.category = { id: categoryId } as Category;
    }
    if (companyId !== undefined) {
      await this.assertCompanyExists(companyId);
      product.company = { id: companyId } as Company;
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

  // --- Additional info ბლოკები (სათაური + აღწერილობა, ულიმიტო რაოდენობა) --

  async getAdditionalInfo(productId: number): Promise<ProductAdditionalInfo[]> {
    await this.findOne(productId); // შეამოწმებს, არსებობს თუ არა
    return this.productAdditionalInfoRepository.find({
      where: { productId },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
  }

  async addAdditionalInfo(
    productId: number,
    createDto: CreateProductAdditionalInfoDto,
  ): Promise<ProductAdditionalInfo> {
    await this.findOne(productId); // შეამოწმებს, არსებობს თუ არა
    const info = this.productAdditionalInfoRepository.create({
      ...createDto,
      productId,
    });
    return this.productAdditionalInfoRepository.save(info);
  }

  async updateAdditionalInfo(
    productId: number,
    infoId: string,
    updateDto: UpdateProductAdditionalInfoDto,
  ): Promise<ProductAdditionalInfo> {
    const info = await this.findAdditionalInfoOrFail(productId, infoId);
    Object.assign(info, updateDto);
    return this.productAdditionalInfoRepository.save(info);
  }

  async removeAdditionalInfo(
    productId: number,
    infoId: string,
  ): Promise<ProductAdditionalInfo> {
    const info = await this.findAdditionalInfoOrFail(productId, infoId);
    return this.productAdditionalInfoRepository.remove(info);
  }

  // --- ფერები (Product ↔ Color, თითოეულზე ცალკე stock) ------------------

  async getColors(productId: number): Promise<ProductColor[]> {
    await this.findOne(productId); // შეამოწმებს, არსებობს თუ არა
    return this.productColorRepository.find({
      where: { productId },
      relations: { color: true },
    });
  }

  // bulk set — მოცემული DTO მასივი მთლიანად ანაცვლებს ამ პროდუქტის
  // არსებულ ფერებს (delete + recreate, setAttributeValues-ის იგივე
  // პატერნით). წინასწარ ვამოწმებთ, რომ ყველა colorId რეალურად არსებობს
  // /colors ბიბლიოთეკაში.
  //
  // product.stock-საც ვასინქრონებთ ფერების stock-ების ჯამზე — CartService/
  // OrdersService checkout-ის დროს ფერიან პროდუქტზე მხოლოდ კონკრეტული
  // ProductColor.stock-ს აკლებენ, მაგრამ product.stock (რომელსაც search/
  // sort/low-stock ლოგიკა კითხულობს) ამ ჯამის საწყისი მნიშვნელობა უნდა
  // იყოს, რომ ორივე თანმიმდევრული დარჩეს. ცარიელი მასივის შემთხვევაში
  // (ფერების მოხსნა) product.stock ხელუხლებელი რჩება — ადმინი ისევ
  // ჩვეულებრივად მართავს მას.
  async setColors(
    productId: number,
    setProductColorsDto: SetProductColorsDto,
  ): Promise<ProductColor[]> {
    const product = await this.findOne(productId); // შეამოწმებს, არსებობს თუ არა

    const colorIds = setProductColorsDto.colors.map((c) => c.colorId);
    const uniqueColorIds = new Set(colorIds);
    if (uniqueColorIds.size !== colorIds.length) {
      throw new BadRequestException(
        'ერთი და იგივე ფერი ვერ განმეორდება ერთ პროდუქტზე',
      );
    }

    if (colorIds.length > 0) {
      const existingColors = await this.colorRepository.findBy({
        id: In(colorIds),
      });
      if (existingColors.length !== uniqueColorIds.size) {
        const foundIds = new Set(existingColors.map((c) => c.id));
        const missing = colorIds.filter((id) => !foundIds.has(id));
        throw new BadRequestException(
          `ფერი(ები) ID-ით ${missing.join(', ')} ვერ მოიძებნა`,
        );
      }
    }

    await this.productColorRepository.delete({ productId });
    if (setProductColorsDto.colors.length === 0) {
      return [];
    }
    const entities = setProductColorsDto.colors.map((item) =>
      this.productColorRepository.create({
        productId,
        colorId: item.colorId,
        stock: item.stock,
      }),
    );
    const saved = await this.productColorRepository.save(entities);

    product.stock = saved.reduce((sum, pc) => sum + pc.stock, 0);
    await this.productRepository.save(product);

    return saved;
  }

  // --- ფილიალები (Product ↔ Branch, თითოეულზე ცალკე stock) --------------

  async getBranches(productId: number): Promise<ProductBranch[]> {
    await this.findOne(productId); // შეამოწმებს, არსებობს თუ არა
    return this.productBranchRepository.find({
      where: { productId },
      relations: { branch: { company: true } },
    });
  }

  // bulk set — setColors-ის ზუსტი ანალოგი (delete + recreate). product.stock-ს
  // აქ არ ვასინქრონებთ ფერების stock-ის მსგავსად — ფილიალის მარაგი
  // დამოუკიდებელი დამატებითი განზომილებაა (იხ. ProductBranch entity-ის
  // კომენტარი), product.stock ისევ ადმინის ხელით/ფერების ჯამით იმართება.
  async setBranches(
    productId: number,
    setProductBranchesDto: SetProductBranchesDto,
  ): Promise<ProductBranch[]> {
    await this.findOne(productId); // შეამოწმებს, არსებობს თუ არა

    const branchIds = setProductBranchesDto.branches.map((b) => b.branchId);
    const uniqueBranchIds = new Set(branchIds);
    if (uniqueBranchIds.size !== branchIds.length) {
      throw new BadRequestException(
        'ერთი და იგივე ფილიალი ვერ განმეორდება ერთ პროდუქტზე',
      );
    }

    if (branchIds.length > 0) {
      const existingBranches = await this.branchRepository.findBy({
        id: In(branchIds),
      });
      if (existingBranches.length !== uniqueBranchIds.size) {
        const foundIds = new Set(existingBranches.map((b) => b.id));
        const missing = branchIds.filter((id) => !foundIds.has(id));
        throw new BadRequestException(
          `ფილიალი(ები) ID-ით ${missing.join(', ')} ვერ მოიძებნა`,
        );
      }
    }

    await this.productBranchRepository.delete({ productId });
    if (setProductBranchesDto.branches.length === 0) {
      return [];
    }
    const entities = setProductBranchesDto.branches.map((item) =>
      this.productBranchRepository.create({
        productId,
        branchId: item.branchId,
        stock: item.stock,
      }),
    );
    return this.productBranchRepository.save(entities);
  }

  private async assertCompanyExists(companyId: string): Promise<void> {
    const exists = await this.companyRepository.exists({
      where: { id: companyId },
    });
    if (!exists) {
      throw new BadRequestException(`კომპანია ID-ით ${companyId} ვერ მოიძებნა`);
    }
  }

  private async findAdditionalInfoOrFail(
    productId: number,
    infoId: string,
  ): Promise<ProductAdditionalInfo> {
    const info = await this.productAdditionalInfoRepository.findOne({
      where: { id: infoId, productId },
    });
    if (!info) {
      throw new NotFoundException(
        `დამატებითი ინფორმაციის ბლოკი ID-ით ${infoId} ვერ მოიძებნა ამ პროდუქტისთვის`,
      );
    }
    return info;
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
