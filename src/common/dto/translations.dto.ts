import {
  IsOptional,
  IsString,
  IsNotEmpty,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Product-ის translations shape — { name, description? } თითოეულ ენაზე.
export class NameDescriptionTranslationDto {
  @ApiProperty({ description: 'სახელი', example: 'უსადენო ყურსასმენი' })
  @IsString({ message: 'name უნდა იყოს ტექსტური' })
  @IsNotEmpty({ message: 'name სავალდებულოა' })
  name!: string;

  @ApiPropertyOptional({
    description: 'აღწერა',
    example: 'ბლუთუზ ყურსასმენი, 20 საათი მუშაობის დრო',
  })
  @IsOptional()
  @IsString({ message: 'description უნდა იყოს ტექსტური' })
  description?: string;
}

// Category/Attribute/Color-ის translations shape — { name } თითოეულ ენაზე.
export class NameTranslationDto {
  @ApiProperty({ description: 'სახელი', example: 'აკუმულატორები' })
  @IsString({ message: 'name უნდა იყოს ტექსტური' })
  @IsNotEmpty({ message: 'name სავალდებულოა' })
  name!: string;
}

// AttributeOption-ის translations shape — { value } თითოეულ ენაზე.
export class ValueTranslationDto {
  @ApiProperty({ description: 'მნიშვნელობა', example: 'ბანერი' })
  @IsString({ message: 'value უნდა იყოს ტექსტური' })
  @IsNotEmpty({ message: 'value სავალდებულოა' })
  value!: string;
}

// HeroSlide-ის translations shape — { eyebrow?, title, description?,
// buttonText? } თითოეულ ენაზე. eyebrow — მთავარი სათაურის ზემოთ პატარა
// ტექსტი (მაგ. "ახალი კოლექცია"), title სავალდებულოა, description/buttonText
// სურვილისამებრ (ღილაკის ლინკი, image, isActive, sortOrder — locale-ისგან
// დამოუკიდებელი, ცალკე plain სვეტებია entity-ში).
export class HeroSlideTranslationDto {
  @ApiPropertyOptional({
    description: 'მთავარი სათაურის ზემოთ პატარა ტექსტი (eyebrow)',
    example: 'ახალი კოლექცია',
  })
  @IsOptional()
  @IsString({ message: 'eyebrow უნდა იყოს ტექსტური' })
  eyebrow?: string;

  @ApiProperty({
    description: 'სლაიდის სათაური',
    example: 'ზაფხულის ფასდაკლება -50%-მდე',
  })
  @IsString({ message: 'title უნდა იყოს ტექსტური' })
  @IsNotEmpty({ message: 'title სავალდებულოა' })
  title!: string;

  @ApiPropertyOptional({
    description: 'სლაიდის აღწერილობა',
    example: 'შეარჩიე შენთვის სასურველი პროდუქტი საუკეთესო ფასად',
  })
  @IsOptional()
  @IsString({ message: 'description უნდა იყოს ტექსტური' })
  description?: string;

  @ApiPropertyOptional({
    description: 'ღილაკის ტექსტი',
    example: 'ყიდვა ახლავე',
  })
  @IsOptional()
  @IsString({ message: 'buttonText უნდა იყოს ტექსტური' })
  buttonText?: string;
}

// ProductSlider-ის translations shape — { title, viewAllText? } თითოეულ
// ენაზე. title სავალდებულოა, viewAllText — სურვილისამებრ ("ყველას ნახვა"
// ღილაკის ტექსტი; თუ არაა მითითებული, frontend-ს default ტექსტი
// გამოაქვს). viewAllLink/key/isActive/sortOrder — locale-ისგან
// დამოუკიდებელი, ცალკე plain სვეტებია entity-ში (HeroSlide-ის იგივე
// პატერნი).
export class ProductSliderTranslationDto {
  @ApiProperty({
    description: 'ბლოკის სათაური',
    example: 'გამორჩეული პროდუქტები',
  })
  @IsString({ message: 'title უნდა იყოს ტექსტური' })
  @IsNotEmpty({ message: 'title სავალდებულოა' })
  title!: string;

  @ApiPropertyOptional({
    description: '"ყველას ნახვა" ღილაკის ტექსტი',
    example: 'ყველას ნახვა',
  })
  @IsOptional()
  @IsString({ message: 'viewAllText უნდა იყოს ტექსტური' })
  viewAllText?: string;
}

// ka ყოველთვის სავალდებულოა (ბიზნეს-წესი — ქართული ბაზისური ენაა,
// resolveTranslation-ის fallback-იც ka-ზეა აგებული), en/ru — სურვილისამებრ.
function buildTranslationsDto<T>(EntryDto: new () => T) {
  class TranslationsDtoBase {
    @ApiProperty({ type: () => EntryDto })
    @ValidateNested()
    @Type(() => EntryDto)
    ka!: T;

    @ApiPropertyOptional({ type: () => EntryDto })
    @IsOptional()
    @ValidateNested()
    @Type(() => EntryDto)
    en?: T;

    @ApiPropertyOptional({ type: () => EntryDto })
    @IsOptional()
    @ValidateNested()
    @Type(() => EntryDto)
    ru?: T;
  }
  return TranslationsDtoBase;
}

// Update DTO-ებისთვის — ka-ც optional-ია (buildTranslationsDto-სგან
// განსხვავებით), რომ PATCH-ს მხოლოდ ერთი locale-ის (მაგ. { en: {...} })
// გამოგზავნაც შეეძლოს 400-ის (ka სავალდებულოა) გარეშე. PartialType
// Create*Dto-დან მხოლოდ translations ველს ხდის optional-ად — არ ჩადის
// ჩადგმულ TranslationsDto-შიც, ka კვლავ სავალდებულო რჩებოდა (იხ. history).
// Update*Dto-ებში translations ველი ცალკე override-ილია ამ Partial
// ვერსიით. ka-ს გამოტოვება უსაფრთხოა — mergeTranslations locale დონეზე
// აერთიანებს, არსებული ka წაშლას არ იწვევს.
function buildPartialTranslationsDto<T>(EntryDto: new () => T) {
  class PartialTranslationsDtoBase {
    @ApiPropertyOptional({ type: () => EntryDto })
    @IsOptional()
    @ValidateNested()
    @Type(() => EntryDto)
    ka?: T;

    @ApiPropertyOptional({ type: () => EntryDto })
    @IsOptional()
    @ValidateNested()
    @Type(() => EntryDto)
    en?: T;

    @ApiPropertyOptional({ type: () => EntryDto })
    @IsOptional()
    @ValidateNested()
    @Type(() => EntryDto)
    ru?: T;
  }
  return PartialTranslationsDtoBase;
}

// Product-ისთვის — { ka: {name, description?}, en?, ru? }
export class ProductTranslationsDto extends buildTranslationsDto(
  NameDescriptionTranslationDto,
) {}

// Category/Attribute/Color-ისთვის — { ka: {name}, en?, ru? }
export class NameTranslationsDto extends buildTranslationsDto(
  NameTranslationDto,
) {}

// AttributeOption-ისთვის — { ka: {value}, en?, ru? }
export class ValueTranslationsDto extends buildTranslationsDto(
  ValueTranslationDto,
) {}

// HeroSlide-ისთვის — { ka: {eyebrow?, title, description?, buttonText?}, en?, ru? }
export class HeroSlideTranslationsDto extends buildTranslationsDto(
  HeroSlideTranslationDto,
) {}

// ProductSlider-ისთვის — { ka: {title, viewAllText?}, en?, ru? }
export class ProductSliderTranslationsDto extends buildTranslationsDto(
  ProductSliderTranslationDto,
) {}

// --- Update DTO-ებში გამოსაყენებელი Partial ვერსიები (ka optional) -------

export class ProductPartialTranslationsDto extends buildPartialTranslationsDto(
  NameDescriptionTranslationDto,
) {}

export class NamePartialTranslationsDto extends buildPartialTranslationsDto(
  NameTranslationDto,
) {}

export class ValuePartialTranslationsDto extends buildPartialTranslationsDto(
  ValueTranslationDto,
) {}

export class HeroSlidePartialTranslationsDto extends buildPartialTranslationsDto(
  HeroSlideTranslationDto,
) {}

export class ProductSliderPartialTranslationsDto extends buildPartialTranslationsDto(
  ProductSliderTranslationDto,
) {}
