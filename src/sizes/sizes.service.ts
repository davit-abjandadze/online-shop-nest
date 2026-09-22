import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Size } from './entities/size.entity';
import { ProductVariant } from '../products/entities/product-variant.entity';
import { CreateSizeDto } from './dto/create-size.dto';
import { UpdateSizeDto } from './dto/update-size.dto';
import { mergeTranslations } from '../common/utils/merge-translations.util';

// ColorsService-ის ზუსტი ანალოგი — ზომების ბიბლიოთეკა (admin-managed,
// მცირე სია).
@Injectable()
export class SizesService {
  constructor(
    @InjectRepository(Size)
    private sizeRepository: Repository<Size>,
    @InjectDataSource()
    private dataSource: DataSource,
  ) {}

  async findAll(): Promise<Size[]> {
    return this.sizeRepository.find({ order: { createdAt: 'ASC' } });
  }

  async findOne(id: string): Promise<Size> {
    const size = await this.sizeRepository.findOne({ where: { id } });
    if (!size) {
      throw new NotFoundException(`ზომა ID-ით ${id} ვერ მოიძებნა`);
    }
    return size;
  }

  async create(createSizeDto: CreateSizeDto): Promise<Size> {
    const size = this.sizeRepository.create(createSizeDto);
    return this.sizeRepository.save(size);
  }

  async update(id: string, updateSizeDto: UpdateSizeDto): Promise<Size> {
    const size = await this.findOne(id); // შეამოწმებს, არსებობს თუ არა
    const { translations, ...rest } = updateSizeDto;
    Object.assign(size, rest);
    if (translations) {
      size.translations = mergeTranslations(size.translations, translations)!;
    }
    return this.sizeRepository.save(size);
  }

  // ColorsService.remove-ის იგივე პატერნი — product_variant-ზე FK
  // CASCADE-ია, ზომის წაშლისას მასზე მიბმული ვარიანტებიც კასკადურად
  // იშლება, Product.stock კი (ProductsService.setVariants-ის მიერ
  // სინქრონებული = ვარიანტების stock-ების ჯამი) ერთი bulk UPDATE...FROM-ით
  // ხელახლა ითვლება დარჩენილი ProductVariant row-ებით დაზარალებულ
  // პროდუქტებზე.
  async remove(id: string): Promise<Size> {
    const size = await this.findOne(id);

    return this.dataSource.transaction(async (manager) => {
      const affected = await manager.find(ProductVariant, {
        where: { sizeId: id },
      });
      const productIds = [...new Set(affected.map((pv) => pv.productId))];

      await manager.remove(Size, size);

      if (productIds.length > 0) {
        await manager.query(
          `UPDATE "product" AS p
           SET stock = COALESCE(agg.total, 0)
           FROM (
             SELECT ids.id, SUM(pv.stock) AS total
             FROM unnest($1::int[]) AS ids(id)
             LEFT JOIN "product_variant" pv ON pv."productId" = ids.id
             GROUP BY ids.id
           ) AS agg
           WHERE p.id = agg.id`,
          [productIds],
        );
      }

      return size;
    });
  }
}
