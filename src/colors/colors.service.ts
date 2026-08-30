import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Color } from './entities/color.entity';
import { CreateColorDto } from './dto/create-color.dto';
import { UpdateColorDto } from './dto/update-color.dto';

@Injectable()
export class ColorsService {
  constructor(
    @InjectRepository(Color)
    private colorRepository: Repository<Color>,
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
    Object.assign(color, updateColorDto);
    return this.colorRepository.save(color);
  }

  async remove(id: string): Promise<Color> {
    const color = await this.findOne(id);
    // product_color-ზე FK CASCADE-ია (იხ. ProductColor) — ფერის წაშლისას
    // მასზე მიბმული პროდუქტ-ფერი row-ებიც კასკადურად წაიშლება.
    return this.colorRepository.remove(color);
  }
}
