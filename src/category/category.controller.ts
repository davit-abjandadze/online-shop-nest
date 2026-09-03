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
import { CategoryService } from './category.service';
import type { CategoryFiltersQuery } from './category.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CategoryResponseDto } from './dto/category-response.dto';
import { FindCategoriesDto } from './dto/find-categories.dto';
import { AddCategoryAttributeDto } from './dto/add-category-attribute.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { Locale } from '../common/decorators/locale.decorator';
import type { Locale as LocaleType } from '../common/types/translations.type';
import { resolveTranslation } from '../common/utils/resolve-translation.util';
import { Category } from './entities/category.entity';

// storefront-ისთვის resolveTranslation-ით ამოღებული `name` ემატება
// entity-ს `translations`-ის გვერდით (ორივე საჭიროა — resolved storefront-
// ისთვის, translations — admin-ის edit ფორმისთვის). parent relation-იც
// (თუ ჩატვირთულია) იმავე სიღრმეზე enrich-დება.
function enrichCategory(category: Category, locale: LocaleType) {
  return {
    ...category,
    name: resolveTranslation(category.translations, locale)?.name,
    ...(category.parent
      ? {
          parent: {
            ...category.parent,
            name: resolveTranslation(category.parent.translations, locale)
              ?.name,
          },
        }
      : {}),
  };
}

// findTree()-ის nested closure-table შედეგისთვის — enrichCategory-სგან
// განსხვავებით, აქ `children`-იც რეკურსიულად უნდა დარეზოლვდეს, თორემ
// ხის ღრმა დონეებზე ისევ ნედლი translations დარჩება @Locale()-ის გვერდის ავლით.
function enrichCategoryTree(category: Category, locale: LocaleType) {
  const enriched = enrichCategory(category, locale);
  return {
    ...enriched,
    ...(category.children
      ? {
          children: category.children.map((child) =>
            enrichCategoryTree(child, locale),
          ),
        }
      : {}),
  };
}

// მკითხველი endpoint-ები (GET) საჯაროა, guard-ის გარეშე — products
// მოდულის მსგავსად. მხოლოდ create/update/delete მოითხოვს ADMIN როლს.
@ApiTags('categories')
@Controller('categories')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Get()
  @ApiOperation({ summary: 'კატეგორიების ბრტყელი, გვერდიანი სია' })
  @ApiResponse({ status: 200, description: 'კატეგორიების გვერდიანი სია' })
  async findAll(
    @Query() findCategoriesDto: FindCategoriesDto,
    @Locale() locale: LocaleType,
  ) {
    const result =
      await this.categoryService.findAllPaginated(findCategoriesDto);
    return {
      ...result,
      data: result.data.map((category) => enrichCategory(category, locale)),
    };
  }

  @Get('tree')
  @ApiOperation({ summary: 'კატეგორიების სრული nested ხე' })
  @ApiResponse({ status: 200, description: 'კატეგორიების ხე' })
  async findTree(@Locale() locale: LocaleType) {
    const tree = await this.categoryService.findTree();
    return tree.map((category) => enrichCategoryTree(category, locale));
  }

  @Get('by-slug/:slug')
  @ApiOperation({ summary: 'კატეგორიის მიღება slug-ით' })
  @ApiResponse({ status: 200, description: 'კატეგორია' })
  @ApiResponse({ status: 404, description: 'კატეგორია ვერ მოიძებნა' })
  async findBySlug(@Param('slug') slug: string, @Locale() locale: LocaleType) {
    const category = await this.categoryService.findBySlug(slug);
    return enrichCategory(category, locale);
  }

  @Get(':id')
  @ApiOperation({ summary: 'კონკრეტული კატეგორიის მიღება' })
  @ApiResponse({ status: 200, description: 'კატეგორია' })
  @ApiResponse({ status: 404, description: 'კატეგორია ვერ მოიძებნა' })
  async findOne(@Param('id') id: string, @Locale() locale: LocaleType) {
    const category = await this.categoryService.findOne(id);
    return enrichCategory(category, locale);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'ახალი კატეგორიის შექმნა (ADMIN)' })
  @ApiResponse({
    status: 201,
    description: 'კატეგორია შეიქმნა',
    type: CategoryResponseDto,
  })
  @ApiResponse({ status: 400, description: 'ვალიდაციის შეცდომა' })
  @ApiResponse({ status: 409, description: 'slug უკვე დაკავებულია' })
  create(@Body() createCategoryDto: CreateCategoryDto) {
    return this.categoryService.create(createCategoryDto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'კატეგორიის განახლება (ADMIN)' })
  @ApiResponse({
    status: 200,
    description: 'კატეგორია განახლდა',
    type: CategoryResponseDto,
  })
  @ApiResponse({ status: 404, description: 'კატეგორია ვერ მოიძებნა' })
  update(
    @Param('id') id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
  ) {
    return this.categoryService.update(id, updateCategoryDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'კატეგორიის წაშლა (ADMIN)' })
  @ApiResponse({ status: 200, description: 'კატეგორია წაიშალა' })
  @ApiResponse({ status: 404, description: 'კატეგორია ვერ მოიძებნა' })
  @ApiResponse({
    status: 409,
    description: 'აქვს შვილები ან მიბმული პროდუქტები',
  })
  remove(@Param('id') id: string) {
    return this.categoryService.remove(id);
  }

  // --- Attribute set (ფაზა 3: Category ↔ Attribute) ---------------------

  @Get(':id/attributes')
  @ApiOperation({
    summary:
      'კატეგორიაზე მიბმული attribute set (წინაპრებისგან მემკვიდრეობით მიღებულის ჩათვლით)',
  })
  @ApiResponse({ status: 200, description: 'attribute set' })
  @ApiResponse({ status: 404, description: 'კატეგორია ვერ მოიძებნა' })
  findAttributes(@Param('id') id: string) {
    return this.categoryService.findAttributesForCategory(id);
  }

  @Post(':id/attributes')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'მახასიათებლის მიბმა კატეგორიაზე (ADMIN)' })
  @ApiResponse({ status: 201, description: 'მახასიათებელი მიებმა კატეგორიას' })
  @ApiResponse({
    status: 404,
    description: 'კატეგორია ან მახასიათებელი ვერ მოიძებნა',
  })
  @ApiResponse({
    status: 409,
    description: 'ეს მახასიათებელი უკვე მიბმულია ამ კატეგორიაზე',
  })
  addAttribute(
    @Param('id') id: string,
    @Body() addCategoryAttributeDto: AddCategoryAttributeDto,
  ) {
    return this.categoryService.addAttributeToCategory(
      id,
      addCategoryAttributeDto,
    );
  }

  @Delete(':id/attributes/:attributeId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'მახასიათებლის მოხსნა კატეგორიიდან (ADMIN)' })
  @ApiResponse({ status: 200, description: 'მახასიათებელი მოიხსნა' })
  @ApiResponse({
    status: 404,
    description: 'ეს მახასიათებელი პირდაპირ მიბმული არ არის ამ კატეგორიაზე',
  })
  removeAttribute(
    @Param('id') id: string,
    @Param('attributeId') attributeId: string,
  ) {
    return this.categoryService.removeAttributeFromCategory(id, attributeId);
  }

  // --- Filter / facet (ფაზა 5: dynamic querybuilder + faceted counts) ---
  //
  // Query-ის ტიპი აქ ცალსახად `Record<string, string>`-ია (არა DTO) —
  // attribute-ის კოდები (`?brand=banner,mutlu&amperage_min=60`) წინასწარ
  // უცნობია, ამიტომ ვერ აღიწერება სტატიკური DTO-თი; გლობალური
  // `ValidationPipe`-ის whitelist ასეთ პარამეტრს (class-ის მეტატიპის
  // გარეშე) უცვლელად ატარებს — ვალიდაცია/parsing სერვისშია.

  @Get(':slug/filters')
  @ApiOperation({
    summary:
      'კატეგორიის (+ ქვეკატეგორიების) filter-adjustable attribute-ები, options + faceted counts, მიმდინარე query-ის გათვალისწინებით',
  })
  @ApiResponse({ status: 200, description: 'filter-ების სია' })
  @ApiResponse({ status: 404, description: 'კატეგორია ვერ მოიძებნა' })
  getFilters(
    @Param('slug') slug: string,
    @Query() query: CategoryFiltersQuery,
    @Locale() locale: LocaleType,
  ) {
    return this.categoryService.getFilters(slug, query, locale);
  }

  @Get(':slug/products')
  @ApiOperation({
    summary:
      'კატეგორიის (+ ქვეკატეგორიების) filtered+paginated პროდუქტების სია',
  })
  @ApiResponse({ status: 200, description: 'პროდუქტების გვერდიანი სია' })
  @ApiResponse({ status: 404, description: 'კატეგორია ვერ მოიძებნა' })
  getProducts(
    @Param('slug') slug: string,
    @Query() query: CategoryFiltersQuery,
  ) {
    return this.categoryService.getProductsForCategory(slug, query);
  }
}
