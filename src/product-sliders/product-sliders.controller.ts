import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ProductSlidersService } from './product-sliders.service';
import { CreateProductSliderDto } from './dto/create-product-slider.dto';
import { UpdateProductSliderDto } from './dto/update-product-slider.dto';
import { FindProductSlidersDto } from './dto/find-product-sliders.dto';
import { SetProductSliderItemsDto } from './dto/set-product-slider-items.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { Locale } from '../common/decorators/locale.decorator';
import type { Locale as LocaleType } from '../common/types/translations.type';
import { resolveTranslation } from '../common/utils/resolve-translation.util';
import { ProductSlider } from './entities/product-slider.entity';
import { Product } from '../products/entities/product.entity';

// storefront-ისთვის product.name/category.name resolve-დება იმავე
// სიღრმეზე, რასაც products.controller.ts-ის enrichProduct აკეთებს — ბლოკის
// items-ს frontend-ისთვის მოსახერხებელ ბრტყელ `products` მასივად ვაქცევთ
// (sortOrder-ის მიხედვით უკვე დალაგებულია service-ის query-დან).
function enrichProduct(product: Product, locale: LocaleType) {
  const resolved = resolveTranslation(product.translations, locale);
  return {
    ...product,
    name: resolved?.name,
    description: resolved?.description,
    ...(product.category
      ? {
          category: {
            ...product.category,
            name: resolveTranslation(product.category.translations, locale)
              ?.name,
          },
        }
      : {}),
  };
}

// storefront-ისთვის resolveTranslation-ით ამოღებული title/viewAllText
// emat-დება entity-ს `translations`-ის გვერდით (ორივე საჭიროა — resolved
// storefront-ისთვის, translations — admin-ის edit ფორმისთვის). items ->
// products ბრტყელ, უკვე resolve-ილ მასივად ვაბრუნებთ.
function enrichProductSlider(productSlider: ProductSlider, locale: LocaleType) {
  const resolved = resolveTranslation(productSlider.translations, locale);
  return {
    ...productSlider,
    title: resolved?.title,
    viewAllText: resolved?.viewAllText,
    products: (productSlider.items ?? []).map((item) =>
      enrichProduct(item.product, locale),
    ),
  };
}

// storefront-ის GET /product-sliders და GET /product-sliders/key/:key
// საჯაროა, guard-ის გარეშე — hero-slides-ის იგივე პატერნი. Admin-ის
// სია/CRUD/items ADMIN როლს მოითხოვს.
@ApiTags('product-sliders')
@Controller('product-sliders')
export class ProductSlidersController {
  constructor(private readonly productSlidersService: ProductSlidersService) {}

  @Get()
  @ApiOperation({
    summary: 'ყველა აქტიური პროდუქტების სლაიდერის ბლოკი (storefront)',
  })
  @ApiResponse({ status: 200, description: 'აქტიური ბლოკების სია' })
  async findActive(@Locale() locale: LocaleType) {
    const productSliders = await this.productSlidersService.findActive();
    return productSliders.map((productSlider) =>
      enrichProductSlider(productSlider, locale),
    );
  }

  @Get('key/:key')
  @ApiOperation({
    summary:
      'კონკრეტული ბლოკი key-ით (storefront) — ნებისმიერ გვერდზე ჩასაშენებლად',
  })
  @ApiResponse({ status: 200, description: 'ბლოკი' })
  @ApiResponse({ status: 404, description: 'ბლოკი ვერ მოიძებნა' })
  async findActiveByKey(
    @Param('key') key: string,
    @Locale() locale: LocaleType,
  ) {
    const productSlider = await this.productSlidersService.findActiveByKey(key);
    return enrichProductSlider(productSlider, locale);
  }

  @Get('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'ბლოკების გვერდიანი სია, აქტიური/არააქტიურის ჩათვლით (ADMIN)',
  })
  @ApiResponse({ status: 200, description: 'ბლოკების გვერდიანი სია' })
  async findAllPaginated(
    @Query() findProductSlidersDto: FindProductSlidersDto,
    @Locale() locale: LocaleType,
  ) {
    const result = await this.productSlidersService.findAllPaginated(
      findProductSlidersDto,
    );
    return {
      ...result,
      data: result.data.map((productSlider) =>
        enrichProductSlider(productSlider, locale),
      ),
    };
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'კონკრეტული ბლოკის მიღება (ADMIN, edit ფორმისთვის)',
  })
  @ApiResponse({ status: 200, description: 'ბლოკი' })
  @ApiResponse({ status: 404, description: 'ბლოკი ვერ მოიძებნა' })
  findOne(@Param('id') id: string) {
    return this.productSlidersService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'ახალი ბლოკის შექმნა (ADMIN)' })
  @ApiResponse({ status: 201, description: 'ბლოკი შეიქმნა' })
  @ApiResponse({ status: 400, description: 'ვალიდაციის შეცდომა' })
  @ApiResponse({ status: 404, description: 'პროდუქტ(ებ)ი ვერ მოიძებნა' })
  @ApiResponse({ status: 409, description: 'ეს key უკვე დაკავებულია' })
  create(@Body() createProductSliderDto: CreateProductSliderDto) {
    return this.productSlidersService.create(createProductSliderDto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'ბლოკის განახლება (ADMIN)' })
  @ApiResponse({ status: 200, description: 'ბლოკი განახლდა' })
  @ApiResponse({
    status: 404,
    description: 'ბლოკი ან პროდუქტ(ებ)ი ვერ მოიძებნა',
  })
  @ApiResponse({ status: 409, description: 'ეს key უკვე დაკავებულია' })
  update(
    @Param('id') id: string,
    @Body() updateProductSliderDto: UpdateProductSliderDto,
  ) {
    return this.productSlidersService.update(id, updateProductSliderDto);
  }

  @Put(':id/items')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'ბლოკის პროდუქტების სრული ჩანაცვლება, სასურველი რიგით (ADMIN)',
  })
  @ApiResponse({ status: 200, description: 'პროდუქტები განახლდა' })
  @ApiResponse({
    status: 404,
    description: 'ბლოკი ან პროდუქტ(ებ)ი ვერ მოიძებნა',
  })
  setItems(
    @Param('id') id: string,
    @Body() setProductSliderItemsDto: SetProductSliderItemsDto,
  ) {
    return this.productSlidersService.setItems(
      id,
      setProductSliderItemsDto.productIds,
    );
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'ბლოკის წაშლა (ADMIN)' })
  @ApiResponse({ status: 200, description: 'ბლოკი წაიშალა' })
  @ApiResponse({ status: 404, description: 'ბლოკი ვერ მოიძებნა' })
  remove(@Param('id') id: string) {
    return this.productSlidersService.remove(id);
  }
}
