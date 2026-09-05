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
import { SkipThrottle } from '@nestjs/throttler';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { SearchProductDto } from './dto/search-product.dto';
import { ProductResponseDto } from './dto/product-response.dto';
import { SetProductAttributeValuesDto } from './dto/set-product-attribute-values.dto';
import { CreateProductAdditionalInfoDto } from './dto/create-product-additional-info.dto';
import { UpdateProductAdditionalInfoDto } from './dto/update-product-additional-info.dto';
import { SetProductColorsDto } from './dto/set-product-colors.dto';
import { SetProductBranchesDto } from './dto/set-product-branches.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../users/entities/user.entity';
import { Locale } from '../common/decorators/locale.decorator';
import type { Locale as LocaleType } from '../common/types/translations.type';
import { resolveTranslation } from '../common/utils/resolve-translation.util';
import { Product } from './entities/product.entity';
import { ProductAttributeValue } from './entities/product-attribute-value.entity';
import { ProductColor } from './entities/product-color.entity';

// storefront-ისთვის resolveTranslation-ით ამოღებული `name`/`description`
// emat-დება entity-ს `translations`-ის გვერდით (ორივე საჭიროა — resolved
// storefront-ისთვის, translations — admin-ის edit ფორმისთვის). category
// relation-იც (თუ ჩატვირთულია) იმავე სიღრმეზე enrich-დება.
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

// attribute-value-ებზე მიბმული attribute/attributeOption-ის translations-იც
// (attribute.name, attributeOption.value) resolve-დება locale-ის მიხედვით,
// enrichAttribute-ის (attribute.controller.ts) იგივე პატერნით.
function enrichProductAttributeValue(
  attributeValue: ProductAttributeValue,
  locale: LocaleType,
) {
  return {
    ...attributeValue,
    ...(attributeValue.attribute
      ? {
          attribute: {
            ...attributeValue.attribute,
            name: resolveTranslation(
              attributeValue.attribute.translations,
              locale,
            )?.name,
          },
        }
      : {}),
    ...(attributeValue.attributeOption
      ? {
          attributeOption: {
            ...attributeValue.attributeOption,
            value: resolveTranslation(
              attributeValue.attributeOption.translations,
              locale,
            )?.value,
          },
        }
      : {}),
  };
}

// მიბმული color-ის translations (color.name) resolve-დება locale-ის
// მიხედვით, enrichColor-ის (colors.controller.ts) იგივე პატერნით.
function enrichProductColor(productColor: ProductColor, locale: LocaleType) {
  return {
    ...productColor,
    ...(productColor.color
      ? {
          color: {
            ...productColor.color,
            name: resolveTranslation(productColor.color.translations, locale)
              ?.name,
          },
        }
      : {}),
  };
}

// მოთვალთვალე/მოხმარებელი endpoint-ები (GET) საჯაროა, guard-ის გარეშე —
// კატეგორიის მსგავსად. მხოლოდ create/update/delete მოითხოვს ADMIN როლს.
// კატალოგის დათვალიერება (და მისი admin-CRUD, რომელიც ისედაც JWT+ROLE-ითაა
// დაცული) გლობალურ per-IP rate limit-ს არ ექვემდებარება — ერთი IP-ის უკან
// ბევრი მყიდველი დგას და ერთი გვერდის ჩატვირთვაც რამდენიმე მოთხოვნაა.
@SkipThrottle()
@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'პროდუქტების სია — ძიება, ფილტრები, პაგინაცია. ტოკენის გარეშე/non-ADMIN ' +
      'მომხმარებელს ყოველთვის მხოლოდ isActive=true პროდუქტები უჩანს; ADMIN-ს ' +
      '(ვალიდური ბირერ ტოკენით) — ყველა, თუ isActive query param-ით სხვა არაა მოთხოვნილი',
  })
  @ApiResponse({ status: 200, description: 'პროდუქტების გვერდიანი სია' })
  async findAll(
    @Query() searchProductDto: SearchProductDto,
    @Locale() locale: LocaleType,
    @CurrentUser() user?: { role: UserRole },
  ) {
    const isAdmin = user?.role === UserRole.ADMIN;
    const result = await this.productsService.findAllPaginated(
      searchProductDto,
      isAdmin,
    );
    return {
      ...result,
      data: result.data.map((product) => enrichProduct(product, locale)),
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'კონკრეტული პროდუქტის მიღება' })
  @ApiResponse({ status: 200, description: 'პროდუქტი' })
  @ApiResponse({ status: 404, description: 'პროდუქტი ვერ მოიძებნა' })
  async findOne(@Param('id') id: string, @Locale() locale: LocaleType) {
    const product = await this.productsService.findOne(+id);
    return enrichProduct(product, locale);
  }

  @Get(':id/similar')
  @ApiOperation({
    summary:
      'მსგავსი პროდუქტების სია (პროდუქტის გვერდის სლაიდერისთვის) — იმავე ' +
      'კატეგორიის აქტიური პროდუქტები, საწყისის გამოკლებით',
  })
  @ApiResponse({ status: 200, description: 'მსგავსი პროდუქტები' })
  @ApiResponse({ status: 404, description: 'პროდუქტი ვერ მოიძებნა' })
  async findSimilar(
    @Param('id') id: string,
    @Query('limit') limit: string | undefined,
    @Locale() locale: LocaleType,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : undefined;
    const products = await this.productsService.findSimilar(
      +id,
      parsedLimit && parsedLimit > 0 ? parsedLimit : undefined,
    );
    return products.map((product) => enrichProduct(product, locale));
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'ახალი პროდუქტის შექმნა (ADMIN)' })
  @ApiResponse({
    status: 201,
    description: 'პროდუქტი შეიქმნა',
    type: ProductResponseDto,
  })
  @ApiResponse({ status: 400, description: 'ვალიდაციის შეცდომა' })
  create(@Body() createProductDto: CreateProductDto) {
    return this.productsService.create(createProductDto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'პროდუქტის განახლება (ADMIN)' })
  @ApiResponse({
    status: 200,
    description: 'პროდუქტი განახლდა',
    type: ProductResponseDto,
  })
  @ApiResponse({ status: 404, description: 'პროდუქტი ვერ მოიძებნა' })
  update(@Param('id') id: string, @Body() updateProductDto: UpdateProductDto) {
    return this.productsService.update(+id, updateProductDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'პროდუქტის წაშლა (ADMIN)' })
  @ApiResponse({ status: 200, description: 'პროდუქტი წაიშალა' })
  @ApiResponse({ status: 404, description: 'პროდუქტი ვერ მოიძებნა' })
  remove(@Param('id') id: string) {
    return this.productsService.remove(+id);
  }

  // --- Attribute values (ფაზა 4: Product ↔ Attribute value) -------------

  @Get(':id/attribute-values')
  @ApiOperation({ summary: 'პროდუქტის attribute value-ების სია' })
  @ApiResponse({ status: 200, description: 'attribute value-ები' })
  @ApiResponse({ status: 404, description: 'პროდუქტი ვერ მოიძებნა' })
  async getAttributeValues(
    @Param('id') id: string,
    @Locale() locale: LocaleType,
  ) {
    const attributeValues = await this.productsService.getAttributeValues(+id);
    return attributeValues.map((attributeValue) =>
      enrichProductAttributeValue(attributeValue, locale),
    );
  }

  @Put(':id/attribute-values')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'პროდუქტის attribute value-ების bulk set (ADMIN) — მთლიანად ანაცვლებს არსებულს',
  })
  @ApiResponse({ status: 200, description: 'attribute value-ები განახლდა' })
  @ApiResponse({ status: 400, description: 'ვალიდაციის შეცდომა' })
  @ApiResponse({ status: 404, description: 'პროდუქტი ვერ მოიძებნა' })
  setAttributeValues(
    @Param('id') id: string,
    @Body() setProductAttributeValuesDto: SetProductAttributeValuesDto,
  ) {
    return this.productsService.setAttributeValues(
      +id,
      setProductAttributeValuesDto,
    );
  }

  // --- Additional info ბლოკები (სათაური + აღწერილობა, ულიმიტო რაოდენობა) --

  @Get(':id/additional-info')
  @ApiOperation({ summary: 'პროდუქტის დამატებითი ინფორმაციის ბლოკების სია' })
  @ApiResponse({ status: 200, description: 'დამატებითი ინფორმაციის ბლოკები' })
  @ApiResponse({ status: 404, description: 'პროდუქტი ვერ მოიძებნა' })
  getAdditionalInfo(@Param('id') id: string) {
    return this.productsService.getAdditionalInfo(+id);
  }

  @Post(':id/additional-info')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'პროდუქტს დამატებითი ინფორმაციის ახალი ბლოკის დამატება (ADMIN)',
  })
  @ApiResponse({ status: 201, description: 'ბლოკი შეიქმნა' })
  @ApiResponse({ status: 400, description: 'ვალიდაციის შეცდომა' })
  @ApiResponse({ status: 404, description: 'პროდუქტი ვერ მოიძებნა' })
  addAdditionalInfo(
    @Param('id') id: string,
    @Body() createDto: CreateProductAdditionalInfoDto,
  ) {
    return this.productsService.addAdditionalInfo(+id, createDto);
  }

  @Put(':id/additional-info/:infoId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'პროდუქტის დამატებითი ინფორმაციის ბლოკის განახლება (ADMIN)',
  })
  @ApiResponse({ status: 200, description: 'ბლოკი განახლდა' })
  @ApiResponse({ status: 404, description: 'ბლოკი ან პროდუქტი ვერ მოიძებნა' })
  updateAdditionalInfo(
    @Param('id') id: string,
    @Param('infoId') infoId: string,
    @Body() updateDto: UpdateProductAdditionalInfoDto,
  ) {
    return this.productsService.updateAdditionalInfo(+id, infoId, updateDto);
  }

  @Delete(':id/additional-info/:infoId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'პროდუქტის დამატებითი ინფორმაციის ბლოკის წაშლა (ADMIN)',
  })
  @ApiResponse({ status: 200, description: 'ბლოკი წაიშალა' })
  @ApiResponse({ status: 404, description: 'ბლოკი ან პროდუქტი ვერ მოიძებნა' })
  removeAdditionalInfo(
    @Param('id') id: string,
    @Param('infoId') infoId: string,
  ) {
    return this.productsService.removeAdditionalInfo(+id, infoId);
  }

  // --- ფერები (Product ↔ Color, თითოეულზე ცალკე stock) ------------------
  // ფერების ბიბლიოთეკის (შექმნა/რედაქტირება) CRUD ცალკე /colors
  // endpoint-შია (იხ. ColorsController) — აქ მხოლოდ უკვე არსებული ფერების
  // კონკრეტულ პროდუქტზე მიბმა/მარაგის მითითება ხდება.

  @Get(':id/colors')
  @ApiOperation({ summary: 'პროდუქტზე მიბმული ფერების სია (stock-ითურთ)' })
  @ApiResponse({ status: 200, description: 'ფერები' })
  @ApiResponse({ status: 404, description: 'პროდუქტი ვერ მოიძებნა' })
  async getColors(@Param('id') id: string, @Locale() locale: LocaleType) {
    const colors = await this.productsService.getColors(+id);
    return colors.map((productColor) =>
      enrichProductColor(productColor, locale),
    );
  }

  @Put(':id/colors')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'პროდუქტის ფერების bulk set (ADMIN) — მთლიანად ანაცვლებს არსებულს',
  })
  @ApiResponse({ status: 200, description: 'ფერები განახლდა' })
  @ApiResponse({ status: 400, description: 'ვალიდაციის შეცდომა' })
  @ApiResponse({ status: 404, description: 'პროდუქტი ვერ მოიძებნა' })
  setColors(
    @Param('id') id: string,
    @Body() setProductColorsDto: SetProductColorsDto,
  ) {
    return this.productsService.setColors(+id, setProductColorsDto);
  }

  // --- ფილიალები (Product ↔ Branch, თითოეულზე ცალკე stock) --------------
  // ფილიალების ბიბლიოთეკის (შექმნა/რედაქტირება) CRUD ცალკე /branches
  // endpoint-შია (იხ. BranchesController) — აქ მხოლოდ უკვე არსებული
  // ფილიალების კონკრეტულ პროდუქტზე მიბმა/მარაგის მითითება ხდება.

  @Get(':id/branches')
  @ApiOperation({ summary: 'პროდუქტზე მიბმული ფილიალების სია (stock-ითურთ)' })
  @ApiResponse({ status: 200, description: 'ფილიალები' })
  @ApiResponse({ status: 404, description: 'პროდუქტი ვერ მოიძებნა' })
  getBranches(@Param('id') id: string) {
    return this.productsService.getBranches(+id);
  }

  @Put(':id/branches')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'პროდუქტის ფილიალების bulk set (ADMIN) — მთლიანად ანაცვლებს არსებულს',
  })
  @ApiResponse({ status: 200, description: 'ფილიალები განახლდა' })
  @ApiResponse({ status: 400, description: 'ვალიდაციის შეცდომა' })
  @ApiResponse({ status: 404, description: 'პროდუქტი ვერ მოიძებნა' })
  setBranches(
    @Param('id') id: string,
    @Body() setProductBranchesDto: SetProductBranchesDto,
  ) {
    return this.productsService.setBranches(+id, setProductBranchesDto);
  }
}
