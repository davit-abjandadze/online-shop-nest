import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Attribute, AttributeType } from './entities/attribute.entity';
import { AttributeOption } from './entities/attribute-option.entity';
import { CreateAttributeDto } from './dto/create-attribute.dto';
import { UpdateAttributeDto } from './dto/update-attribute.dto';
import { FindAttributesDto } from './dto/find-attributes.dto';
import { CreateAttributeOptionDto } from './dto/create-attribute-option.dto';
import { UpdateAttributeOptionDto } from './dto/update-attribute-option.dto';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';

// sortBy პარამეტრი პირდაპირ user-ისგან მოდის query string-იდან — SQL
// injection-ის თავიდან ასაცილებლად ვუშვებთ მხოლოდ ცნობილ სვეტებს
// (იხ. category.service.ts/products.service.ts-ის იგივე პატერნი).
const SORTABLE_COLUMNS = new Set([
  'id',
  'nameKa',
  'nameEn',
  'code',
  'type',
  'sortOrder',
  'createdAt',
]);

// select/multi_select ტიპებს options სჭირდება, დანარჩენებს — არა. ეს წესი
// create/update-ზეც მოწმდება (option-ის დამატება არა-select attribute-ზე
// უაზრობაა) და, სამომავლოდ, product_attribute_value-ის ვალიდაციაშიც
// გამოყენებული იქნება (ფაზა 4).
const OPTION_BASED_TYPES = new Set([
  AttributeType.SELECT,
  AttributeType.MULTI_SELECT,
]);

@Injectable()
export class AttributeService {
  constructor(
    @InjectRepository(Attribute)
    private attributeRepository: Repository<Attribute>,
    @InjectRepository(AttributeOption)
    private attributeOptionRepository: Repository<AttributeOption>,
  ) {}

  async findAllPaginated(
    findAttributesDto: FindAttributesDto,
  ): Promise<PaginatedResponseDto<Attribute>> {
    const {
      page = 1,
      limit = 10,
      sortBy = 'sortOrder',
      order = 'ASC',
      type,
      isFilterable,
    } = findAttributesDto;

    const qb = this.attributeRepository
      .createQueryBuilder('attribute')
      .leftJoinAndSelect('attribute.options', 'options')
      .orderBy('options.sortOrder', 'ASC');

    if (type) {
      qb.andWhere('attribute.type = :type', { type });
    }
    if (isFilterable !== undefined) {
      qb.andWhere('attribute.isFilterable = :isFilterable', { isFilterable });
    }

    const sortColumn = SORTABLE_COLUMNS.has(sortBy) ? sortBy : 'sortOrder';
    qb.addOrderBy(`attribute.${sortColumn}`, order === 'DESC' ? 'DESC' : 'ASC');
    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();
    return new PaginatedResponseDto(data, total, page, limit);
  }

  async findOne(id: string): Promise<Attribute> {
    const attribute = await this.attributeRepository.findOne({
      where: { id },
      relations: { options: true },
      order: { options: { sortOrder: 'ASC' } },
    });
    if (!attribute) {
      throw new NotFoundException(`მახასიათებელი ID-ით ${id} ვერ მოიძებნა`);
    }
    return attribute;
  }

  async create(createAttributeDto: CreateAttributeDto): Promise<Attribute> {
    await this.ensureCodeIsFree(createAttributeDto.code);

    const attribute = this.attributeRepository.create(createAttributeDto);
    return this.attributeRepository.save(attribute);
  }

  async update(
    id: string,
    updateAttributeDto: UpdateAttributeDto,
  ): Promise<Attribute> {
    const attribute = await this.findOne(id); // შეამოწმებს, არსებობს თუ არა

    if (updateAttributeDto.code && updateAttributeDto.code !== attribute.code) {
      await this.ensureCodeIsFree(updateAttributeDto.code);
    }

    Object.assign(attribute, updateAttributeDto);
    return this.attributeRepository.save(attribute);
  }

  async remove(id: string): Promise<Attribute> {
    const attribute = await this.findOne(id);

    // category_attribute/product_attribute_value join-ები ჯერ არ არსებობს
    // (ფაზა 3/4), ამიტომ ამ ეტაპზე წაშლის დამატებითი დაცვა არ სჭირდება —
    // options კასკადურად წაიშლება (`cascade: true` entity-ზე).
    return this.attributeRepository.remove(attribute);
  }

  async addOption(
    attributeId: string,
    createOptionDto: CreateAttributeOptionDto,
  ): Promise<AttributeOption> {
    const attribute = await this.findOne(attributeId);
    this.assertOptionBasedType(attribute);
    await this.ensureOptionCodeIsFree(attributeId, createOptionDto.code);

    const option = this.attributeOptionRepository.create({
      ...createOptionDto,
      attribute,
      attributeId,
    });
    return this.attributeOptionRepository.save(option);
  }

  async updateOption(
    attributeId: string,
    optionId: string,
    updateOptionDto: UpdateAttributeOptionDto,
  ): Promise<AttributeOption> {
    const option = await this.findOption(attributeId, optionId);

    if (updateOptionDto.code && updateOptionDto.code !== option.code) {
      await this.ensureOptionCodeIsFree(attributeId, updateOptionDto.code);
    }

    Object.assign(option, updateOptionDto);
    return this.attributeOptionRepository.save(option);
  }

  async removeOption(
    attributeId: string,
    optionId: string,
  ): Promise<AttributeOption> {
    const option = await this.findOption(attributeId, optionId);
    return this.attributeOptionRepository.remove(option);
  }

  private async findOption(
    attributeId: string,
    optionId: string,
  ): Promise<AttributeOption> {
    const option = await this.attributeOptionRepository.findOne({
      where: { id: optionId, attributeId },
    });
    if (!option) {
      throw new NotFoundException(
        `ოფცია ID-ით ${optionId} ვერ მოიძებნა ამ მახასიათებელზე`,
      );
    }
    return option;
  }

  private assertOptionBasedType(attribute: Attribute): void {
    if (!OPTION_BASED_TYPES.has(attribute.type)) {
      throw new BadRequestException(
        `ოფციების დამატება შესაძლებელია მხოლოდ select/multi_select ტიპის მახასიათებლებზე (ეს არის "${attribute.type}")`,
      );
    }
  }

  private async ensureCodeIsFree(code: string): Promise<void> {
    const existing = await this.attributeRepository.findOne({
      where: { code },
    });
    if (existing) {
      throw new ConflictException(
        `მახასიათებელი ამ კოდით ("${code}") უკვე არსებობს`,
      );
    }
  }

  private async ensureOptionCodeIsFree(
    attributeId: string,
    code: string,
  ): Promise<void> {
    const existing = await this.attributeOptionRepository.findOne({
      where: { attributeId, code },
    });
    if (existing) {
      throw new ConflictException(
        `ამ მახასიათებელზე ოფცია ამ კოდით ("${code}") უკვე არსებობს`,
      );
    }
  }
}
