import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HeroSlide } from './entities/hero-slide.entity';
import { Product } from '../products/entities/product.entity';
import { CreateHeroSlideDto } from './dto/create-hero-slide.dto';
import { UpdateHeroSlideDto } from './dto/update-hero-slide.dto';
import { FindHeroSlidesDto } from './dto/find-hero-slides.dto';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { mergeTranslations } from '../common/utils/merge-translations.util';

// sortBy პარამეტრი პირდაპირ user-ისგან მოდის query string-იდან — SQL
// injection-ის თავიდან ასაცილებლად ვუშვებთ მხოლოდ ცნობილ სვეტებს
// (იხ. category.service.ts-ის იგივე პატერნი).
const SORTABLE_COLUMNS = new Set(['id', 'sortOrder', 'createdAt']);

@Injectable()
export class HeroSlidesService {
  constructor(
    @InjectRepository(HeroSlide)
    private heroSlideRepository: Repository<HeroSlide>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
  ) {}

  // storefront-ისთვის — მხოლოდ აქტიური სლაიდები, sortOrder-ის მიხედვით
  // ასაკენდელი, პროდუქტით ჩატვირთული (ღილაკის ლინკის derive-ისთვის).
  async findActive(): Promise<HeroSlide[]> {
    return this.heroSlideRepository.find({
      where: { isActive: true },
      relations: { product: true },
      order: { sortOrder: 'ASC' },
    });
  }

  async findAllPaginated(
    findHeroSlidesDto: FindHeroSlidesDto,
  ): Promise<PaginatedResponseDto<HeroSlide>> {
    const {
      page = 1,
      limit = 10,
      sortBy = 'sortOrder',
      order = 'ASC',
      isActive,
    } = findHeroSlidesDto;

    const qb = this.heroSlideRepository
      .createQueryBuilder('heroSlide')
      .leftJoinAndSelect('heroSlide.product', 'product');

    if (isActive !== undefined) {
      qb.andWhere('heroSlide.isActive = :isActive', { isActive });
    }

    const sortColumn = SORTABLE_COLUMNS.has(sortBy) ? sortBy : 'sortOrder';
    qb.orderBy(`heroSlide.${sortColumn}`, order === 'DESC' ? 'DESC' : 'ASC');
    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();
    return new PaginatedResponseDto(data, total, page, limit);
  }

  async findOne(id: string): Promise<HeroSlide> {
    const heroSlide = await this.heroSlideRepository.findOne({
      where: { id },
      relations: { product: true },
    });
    if (!heroSlide) {
      throw new NotFoundException(`სლაიდი ID-ით ${id} ვერ მოიძებნა`);
    }
    return heroSlide;
  }

  async create(createHeroSlideDto: CreateHeroSlideDto): Promise<HeroSlide> {
    const { productId, ...rest } = createHeroSlideDto;
    const heroSlide = this.heroSlideRepository.create({
      ...rest,
      ...(productId ? { product: await this.findProduct(productId) } : {}),
    });
    return this.heroSlideRepository.save(heroSlide);
  }

  async update(
    id: string,
    updateHeroSlideDto: UpdateHeroSlideDto,
  ): Promise<HeroSlide> {
    const heroSlide = await this.findOne(id); // შეამოწმებს, არსებობს თუ არა

    // per-locale deep-merge Object.assign-მდე — თუ ადმინი მხოლოდ ერთი
    // locale-ის translations გამოაგზავნა (მაგ. { en: {...} }), დანარჩენი
    // locale-ები (ka/ru) არ უნდა წაიშალოს (იხ. category.service.ts).
    const { productId, translations, ...rest } = updateHeroSlideDto;
    Object.assign(heroSlide, rest);
    if (translations) {
      heroSlide.translations = mergeTranslations(
        heroSlide.translations,
        translations,
      )!;
    }

    if (productId !== undefined) {
      heroSlide.product = productId ? await this.findProduct(productId) : null;
    }

    return this.heroSlideRepository.save(heroSlide);
  }

  async remove(id: string): Promise<HeroSlide> {
    const heroSlide = await this.findOne(id);
    return this.heroSlideRepository.remove(heroSlide);
  }

  private async findProduct(productId: number): Promise<Product> {
    const product = await this.productRepository.findOne({
      where: { id: productId },
    });
    if (!product) {
      throw new NotFoundException(`პროდუქტი ID-ით ${productId} ვერ მოიძებნა`);
    }
    return product;
  }
}
