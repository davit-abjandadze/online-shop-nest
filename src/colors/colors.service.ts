import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Color } from './entities/color.entity';
import { ProductColor } from '../products/entities/product-color.entity';
import { Product } from '../products/entities/product.entity';
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
    // წაშლის შემდეგ კი თითოეულს Product.stock-ს ხელახლა ვთვლით დარჩენილი
    // ProductColor row-ების ჯამით.
    return this.dataSource.transaction(async (manager) => {
      const affected = await manager.find(ProductColor, {
        where: { colorId: id },
      });
      const productIds = [...new Set(affected.map((pc) => pc.productId))];

      await manager.remove(Color, color);

      for (const productId of productIds) {
        const remaining = await manager.find(ProductColor, {
          where: { productId },
        });
        const stock = remaining.reduce((sum, pc) => sum + pc.stock, 0);
        await manager.update(Product, productId, { stock });
      }

      return color;
    });
  }
}
