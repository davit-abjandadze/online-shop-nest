import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Color } from './entities/color.entity';
import { ProductColor } from '../products/entities/product-color.entity';
import { ProductVariant } from '../products/entities/product-variant.entity';
import { CreateColorDto } from './dto/create-color.dto';
import { UpdateColorDto } from './dto/update-color.dto';
import { mergeTranslations } from '../common/utils/merge-translations.util';

@Injectable()
export class ColorsService {
  constructor(
    @InjectRepository(Color)
    private colorRepository: Repository<Color>,
    @InjectDataSource()
    private dataSource: DataSource,
  ) {}

  // ფერების ბიბლიოთეკა მცირე, admin-managed სია — pagination-ი აქ
  // ზედმეტია (products.service.ts-ის attribute-values dropdown-ის მსგავსად).
  async findAll(): Promise<Color[]> {
    return this.colorRepository.find({ order: { createdAt: 'ASC' } });
  }

  async findOne(id: string): Promise<Color> {
    const color = await this.colorRepository.findOne({ where: { id } });
    if (!color) {
      throw new NotFoundException(`ფერი ID-ით ${id} ვერ მოიძებნა`);
    }
    return color;
  }

  async create(createColorDto: CreateColorDto): Promise<Color> {
    const color = this.colorRepository.create(createColorDto);
    return this.colorRepository.save(color);
  }

  async update(id: string, updateColorDto: UpdateColorDto): Promise<Color> {
    const color = await this.findOne(id); // შეამოწმებს, არსებობს თუ არა
    // per-locale deep-merge Object.assign-მდე — თუ ადმინი მხოლოდ ერთი
    // locale-ის translations გამოაგზავნა (მაგ. { en: {...} }), დანარჩენი
    // locale-ები (ka/ru) არ უნდა წაიშალოს (იხ. mergeTranslations).
    const { translations, ...rest } = updateColorDto;
    Object.assign(color, rest);
    if (translations) {
      color.translations = mergeTranslations(color.translations, translations)!;
    }
    return this.colorRepository.save(color);
  }

  async remove(id: string): Promise<Color> {
    const color = await this.findOne(id);
    // product_color-ზე FK CASCADE-ია (იხ. ProductColor) — ფერის წაშლისას
    // მასზე მიბმული პროდუქტ-ფერი row-ებიც კასკადურად წაიშლება.
    //
    // ⚠️ ფიქსი: Product.stock ProductsService.setColors()-ის მიერ ხელით
    // სინქრონდება (= ფერების stock-ების ჯამი) — CASCADE-ით წაშლილი
    // ProductColor row-ები setColors-ს არ ავლენს, ანუ Product.stock ამ
    // წაშლის შემდეგ მუდმივად გადაჭარბებულს აჩვენებდა ხელმისაწვდომობას.
    // ტრანზაქციაში წინასწარ ვნიშნავთ, რომელ პროდუქტებზეა ეს ფერი მიბმული,
    // წაშლის შემდეგ კი ერთი bulk UPDATE...FROM-ით ვითვლით Product.stock-ს
    // დარჩენილი ProductColor row-ების ჯამით — orders.service.ts-ის
    // restockOrderItems-ის იგივე პატერნი, თითო პროდუქტზე ცალკე
    // find+update round-trip-ის მაგივრად.
    return this.dataSource.transaction(async (manager) => {
      // ფერი ProductVariant-შიც (ფერი+ზომა) მონაწილეობს და იქიდანაც CASCADE-ით
      // იშლება — ვარიანტიანი პროდუქტის stock ვარიანტების ჯამია, ამიტომ მათაც
      // ვითვლით (აქამდე მხოლოდ product_color-ს ითვალისწინებდა და ვარიანტიანი
      // პროდუქტის stock გადაჭარბებული რჩებოდა).
      const [affectedColors, affectedVariants] = await Promise.all([
        manager.find(ProductColor, { where: { colorId: id } }),
        manager.find(ProductVariant, { where: { colorId: id } }),
      ]);
      const productIds = [
        ...new Set([
          ...affectedColors.map((pc) => pc.productId),
          ...affectedVariants.map((pv) => pv.productId),
        ]),
      ];

      await manager.remove(Color, color);

      if (productIds.length > 0) {
        // ვარიანტები რჩება → მათი ჯამი; თორემ დარჩენილი ფერების ჯამი (ან 0).
        await manager.query(
          `UPDATE "product" AS p
           SET stock = COALESCE(
             (SELECT SUM(pv.stock) FROM "product_variant" pv WHERE pv."productId" = p.id),
             (SELECT SUM(pc.stock) FROM "product_color" pc WHERE pc."productId" = p.id),
             0
           )
           WHERE p.id = ANY($1::int[])`,
          [productIds],
        );
      }

      return color;
    });
  }
}
