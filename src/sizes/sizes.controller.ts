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
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { SizesService } from './sizes.service';
import { CreateSizeDto } from './dto/create-size.dto';
import { UpdateSizeDto } from './dto/update-size.dto';
import { AdminOnly } from '../common/decorators/admin-only.decorator';
import { Locale } from '../common/decorators/locale.decorator';
import type { Locale as LocaleType } from '../common/types/translations.type';
import { resolveTranslation } from '../common/utils/resolve-translation.util';
import { Size } from './entities/size.entity';

// ColorsController-ის ზუსტი ანალოგი.
function enrichSize(size: Size, locale: LocaleType) {
  return {
    ...size,
    name: resolveTranslation(size.translations, locale)?.name,
  };
}

// ზომების ბიბლიოთეკის ცალკე CRUD (ADMIN) — პროდუქტზე ვარიანტების
// (ფერი+ზომა) მიბმა/მარაგი/ფასი products.controller.ts-შია
// (`/products/:id/variants`).
@SkipThrottle()
@ApiTags('sizes')
@Controller('sizes')
export class SizesController {
  constructor(private readonly sizesService: SizesService) {}

  @Get()
  @ApiOperation({ summary: 'ზომების სია' })
  @ApiResponse({ status: 200, description: 'ზომების სია' })
  async findAll(@Locale() locale: LocaleType) {
    const sizes = await this.sizesService.findAll();
    return sizes.map((size) => enrichSize(size, locale));
  }

  @Get(':id')
  @ApiOperation({ summary: 'კონკრეტული ზომის მიღება' })
  @ApiResponse({ status: 200, description: 'ზომა' })
  @ApiResponse({ status: 404, description: 'ზომა ვერ მოიძებნა' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Locale() locale: LocaleType,
  ) {
    const size = await this.sizesService.findOne(id);
    return enrichSize(size, locale);
  }

  @Post()
  @AdminOnly()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'ახალი ზომის შექმნა (ADMIN)' })
  @ApiResponse({ status: 201, description: 'ზომა შეიქმნა' })
  @ApiResponse({ status: 400, description: 'ვალიდაციის შეცდომა' })
  create(@Body() createSizeDto: CreateSizeDto) {
    return this.sizesService.create(createSizeDto);
  }

  @Put(':id')
  @AdminOnly()
  @ApiOperation({ summary: 'ზომის განახლება (ADMIN)' })
  @ApiResponse({ status: 200, description: 'ზომა განახლდა' })
  @ApiResponse({ status: 404, description: 'ზომა ვერ მოიძებნა' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateSizeDto: UpdateSizeDto,
  ) {
    return this.sizesService.update(id, updateSizeDto);
  }

  @Delete(':id')
  @AdminOnly()
  @ApiOperation({ summary: 'ზომის წაშლა (ADMIN)' })
  @ApiResponse({ status: 200, description: 'ზომა წაიშალა' })
  @ApiResponse({ status: 404, description: 'ზომა ვერ მოიძებნა' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.sizesService.remove(id);
  }
}
