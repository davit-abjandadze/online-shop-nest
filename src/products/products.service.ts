import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { Category } from '../category/entities/category.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { SearchProductDto } from './dto/search-product.dto';
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
}
