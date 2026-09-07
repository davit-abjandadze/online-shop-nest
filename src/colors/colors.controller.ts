import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { ColorsService } from './colors.service';
import { CreateColorDto } from './dto/create-color.dto';
import { UpdateColorDto } from './dto/update-color.dto';
import { AdminOnly } from '../common/decorators/admin-only.decorator';
import { Locale } from '../common/decorators/locale.decorator';
import type { Locale as LocaleType } from '../common/types/translations.type';
import { resolveTranslation } from '../common/utils/resolve-translation.util';
import { Color } from './entities/color.entity';

// storefront-ისთვის resolveTranslation-ით ამოღებული `name` emat-დება
// entity-ს `translations`-ის გვერდით (ორივე საჭიროა — resolved
// storefront-ისთვის, translations — admin-ის edit ფორმისთვის).
function enrichColor(color: Color, locale: LocaleType) {
  return {
    ...color,
    name: resolveTranslation(color.translations, locale)?.name,
  };
}

// ფერების ბიბლიოთეკის ცალკე CRUD (ADMIN) — პროდუქტზე ფერების მიბმა/
// მარაგის მითითება products.controller.ts-შია (`/products/:id/colors`).
// მკითხველი endpoint-ები (GET) საჯაროა — admin-ის პროდუქტის ფორმას/
// frontend-ს სჭირდება ფერების სია ავტორიზაციის გარეშეც.
// კატალოგის endpoint-ები per-IP rate limit-ს არ ექვემდებარება — იხ. AppModule.
@SkipThrottle()
@ApiTags('colors')
@Controller('colors')
export class ColorsController {
  constructor(private readonly colorsService: ColorsService) {}

  @Get()
  @ApiOperation({ summary: 'ფერების სია' })
  @ApiResponse({ status: 200, description: 'ფერების სია' })
  async findAll(@Locale() locale: LocaleType) {
    const colors = await this.colorsService.findAll();
    return colors.map((color) => enrichColor(color, locale));
  }

  @Get(':id')
  @ApiOperation({ summary: 'კონკრეტული ფერის მიღება' })
  @ApiResponse({ status: 200, description: 'ფერი' })
  @ApiResponse({ status: 404, description: 'ფერი ვერ მოიძებნა' })
  async findOne(@Param('id') id: string, @Locale() locale: LocaleType) {
    const color = await this.colorsService.findOne(id);
    return enrichColor(color, locale);
  }

  @Post()
  @AdminOnly()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'ახალი ფერის შექმნა (ADMIN)' })
  @ApiResponse({ status: 201, description: 'ფერი შეიქმნა' })
  @ApiResponse({ status: 400, description: 'ვალიდაციის შეცდომა' })
  create(@Body() createColorDto: CreateColorDto) {
    return this.colorsService.create(createColorDto);
  }

  @Put(':id')
  @AdminOnly()
  @ApiOperation({ summary: 'ფერის განახლება (ADMIN)' })
  @ApiResponse({ status: 200, description: 'ფერი განახლდა' })
  @ApiResponse({ status: 404, description: 'ფერი ვერ მოიძებნა' })
  update(@Param('id') id: string, @Body() updateColorDto: UpdateColorDto) {
    return this.colorsService.update(id, updateColorDto);
  }

  @Delete(':id')
  @AdminOnly()
  @ApiOperation({ summary: 'ფერის წაშლა (ADMIN)' })
  @ApiResponse({ status: 200, description: 'ფერი წაიშალა' })
  @ApiResponse({ status: 404, description: 'ფერი ვერ მოიძებნა' })
  remove(@Param('id') id: string) {
    return this.colorsService.remove(id);
  }
}
