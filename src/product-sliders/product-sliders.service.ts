import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ProductSlider } from './entities/product-slider.entity';
import { ProductSliderItem } from './entities/product-slider-item.entity';
import { Product } from '../products/entities/product.entity';
import { CreateProductSliderDto } from './dto/create-product-slider.dto';
import { UpdateProductSliderDto } from './dto/update-product-slider.dto';
import { FindProductSlidersDto } from './dto/find-product-sliders.dto';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { resolveSortColumn } from '../common/dto/pagination.dto';
import { mergeTranslations } from '../common/utils/merge-translations.util';

// sortBy პარამეტრი პირდაპირ user-ისგან მოდის query string-იდან — SQL
// injection-ის თავიდან ასაცილებლად ვუშვებთ მხოლოდ ცნობილ სვეტებს
// (იხ. category.service.ts-ის იგივე პატერნი).
const SORTABLE_COLUMNS = new Set(['id', 'key', 'sortOrder', 'createdAt']);

@Injectable()
export class ProductSlidersService {
  constructor(
    @InjectRepository(ProductSlider)
    private productSliderRepository: Repository<ProductSlider>,
    @InjectRepository(ProductSliderItem)
    private productSliderItemRepository: Repository<ProductSliderItem>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
  ) {}

  // storefront-ისთვის — ყველა აქტიური ბლოკი, sortOrder-ის მიხედვით
  // ასაკენდელი, პროდუქტებით ჩატვირთული (frontend-ს რომ ერთი მოთხოვნით
  // შეეძლოს გვერდზე ყველა embed-ილი ბლოკის ამოღება). item.product.isActive-იც
  // აქ მოწმდება (hero-slides.service.ts-ის იგივე პატერნი) — მაგრამ
  // `product.isActive = true` join-პირობა მხოლოდ item.product-ს აქცევს
  // null-ად, თავად item-ს კი ეს არ გამორიცხავს (LEFT JOIN) — ამიტომ
  // null-product item-ები ცალკე filter-დება ქვემოთ, თორემ
  // enrichProductSlider (item.product.translations) 500-ს დააგდებდა.
  async findActive(): Promise<ProductSlider[]> {
    const sliders = await this.productSliderRepository
      .createQueryBuilder('productSlider')
      .leftJoinAndSelect('productSlider.items', 'item')
      .leftJoinAndSelect('item.product', 'product', 'product.isActive = true')
      .leftJoinAndSelect('product.category', 'category')
      .where('productSlider.isActive = :isActive', { isActive: true })
      .orderBy('productSlider.sortOrder', 'ASC')
      .addOrderBy('item.sortOrder', 'ASC')
      .getMany();
    return sliders.map((slider) => this.dropInactiveItems(slider));
  }

  // storefront-ისთვის — კონკრეტული ბლოკი key-ით, frontend-ს რომ ნებისმიერ
  // გვერდზე ამ ერთი ბლოკის ჩაშენება შეეძლოს (`GET /product-sliders/key/:key`).
  // item.product.isActive-იც აქ მოწმდება findActive-ის იგივე პატერნით.
  async findActiveByKey(key: string): Promise<ProductSlider> {
    const productSlider = await this.productSliderRepository
      .createQueryBuilder('productSlider')
      .leftJoinAndSelect('productSlider.items', 'item')
      .leftJoinAndSelect('item.product', 'product', 'product.isActive = true')
      .leftJoinAndSelect('product.category', 'category')
      .where('productSlider.key = :key', { key })
      .andWhere('productSlider.isActive = :isActive', { isActive: true })
      .orderBy('item.sortOrder', 'ASC')
      .getOne();
    if (!productSlider) {
      throw new NotFoundException(`ბლოკი key-ით "${key}" ვერ მოიძებნა`);
    }
    return this.dropInactiveItems(productSlider);
  }

  // LEFT JOIN ... ON product.isActive = true მხოლოდ item.product-ს ტოვებს
  // null-ად დეაქტივირებული პროდუქტისთვის — თავად item-ს (disconnected
  // product-ით) აქ ვაშორებთ მასივიდან, რომ enrichProductSlider-მა
  // null-ზე ვერ დაარტყას.
  private dropInactiveItems(slider: ProductSlider): ProductSlider {
    return {
      ...slider,
      items: (slider.items ?? []).filter((item) => item.product != null),
    };
  }

  async findAllPaginated(
    findProductSlidersDto: FindProductSlidersDto,
  ): Promise<PaginatedResponseDto<ProductSlider>> {
    const {
      page = 1,
      limit = 10,
      sortBy = 'sortOrder',
      order = 'ASC',
      isActive,
    } = findProductSlidersDto;

    const qb = this.productSliderRepository
      .createQueryBuilder('productSlider')
      .leftJoinAndSelect('productSlider.items', 'item')
      .leftJoinAndSelect('item.product', 'product');

    if (isActive !== undefined) {
      qb.andWhere('productSlider.isActive = :isActive', { isActive });
    }

    const sortColumn = resolveSortColumn(sortBy, SORTABLE_COLUMNS, 'sortOrder');
    qb.orderBy(
      `productSlider.${sortColumn}`,
      order === 'DESC' ? 'DESC' : 'ASC',
    );
    qb.addOrderBy('item.sortOrder', 'ASC');
    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();
    return new PaginatedResponseDto(data, total, page, limit);
  }

  async findOne(id: string): Promise<ProductSlider> {
    const productSlider = await this.productSliderRepository.findOne({
      where: { id },
      relations: { items: { product: true } },
      order: { items: { sortOrder: 'ASC' } },
    });
    if (!productSlider) {
      throw new NotFoundException(`ბლოკი ID-ით ${id} ვერ მოიძებნა`);
    }
    return productSlider;
  }

  async create(
    createProductSliderDto: CreateProductSliderDto,
  ): Promise<ProductSlider> {
    await this.ensureKeyIsFree(createProductSliderDto.key);

    const { productIds, ...rest } = createProductSliderDto;
    const productSlider = await this.productSliderRepository.save(
      this.productSliderRepository.create(rest),
    );

    if (productIds?.length) {
      await this.replaceItems(productSlider.id, productIds);
    }

    return this.findOne(productSlider.id);
  }

  async update(
    id: string,
    updateProductSliderDto: UpdateProductSliderDto,
  ): Promise<ProductSlider> {
    const productSlider = await this.findOne(id); // შეამოწმებს, არსებობს თუ არა

    if (
      updateProductSliderDto.key &&
      updateProductSliderDto.key !== productSlider.key
    ) {
      await this.ensureKeyIsFree(updateProductSliderDto.key);
    }

    // per-locale deep-merge Object.assign-მდე — თუ ადმინი მხოლოდ ერთი
    // locale-ის translations გამოაგზავნა (მაგ. { en: {...} }), დანარჩენი
    // locale-ები (ka/ru) არ უნდა წაიშალოს (იხ. category.service.ts).
    const { productIds, translations, ...rest } = updateProductSliderDto;
    Object.assign(productSlider, rest);
    if (translations) {
      productSlider.translations = mergeTranslations(
        productSlider.translations,
        translations,
      )!;
    }

    await this.productSliderRepository.save(productSlider);

    if (productIds !== undefined) {
      await this.replaceItems(id, productIds);
    }

    return this.findOne(id);
  }

  async remove(id: string): Promise<ProductSlider> {
    const productSlider = await this.findOne(id);
    return this.productSliderRepository.remove(productSlider);
  }

  // PUT /product-sliders/:id/items — items-ის ცალკე bulk set, translations-ის
  // შეხების გარეშე (ProductsService.setColors-ის იგივე delete+recreate
  // პატერნი).
  async setItems(id: string, productIds: number[]): Promise<ProductSlider> {
    await this.findOne(id); // შეამოწმებს, არსებობს თუ არა
    await this.replaceItems(id, productIds);
    return this.findOne(id);
  }

  private async replaceItems(
    productSliderId: string,
    productIds: number[],
  ): Promise<void> {
    if (productIds.length) {
      const products = await this.productRepository.find({
        where: { id: In(productIds) },
      });
      const foundIds = new Set(products.map((product) => product.id));
      const missingIds = productIds.filter((pid) => !foundIds.has(pid));
      if (missingIds.length) {
        throw new NotFoundException(
          `პროდუქტ(ებ)ი ID-ებით ${missingIds.join(', ')} ვერ მოიძებნა`,
        );
      }
    }

    await this.productSliderItemRepository.delete({ productSliderId });
    if (!productIds.length) {
      return;
    }

    const entities = productIds.map((productId, index) =>
      this.productSliderItemRepository.create({
        productSliderId,
        productId,
        sortOrder: index,
      }),
    );
    await this.productSliderItemRepository.save(entities);
  }

  private async ensureKeyIsFree(key: string): Promise<void> {
    const existing = await this.productSliderRepository.findOne({
      where: { key },
    });
    if (existing) {
      throw new ConflictException(`ბლოკი ამ key-ით ("${key}") უკვე არსებობს`);
    }
  }
}
