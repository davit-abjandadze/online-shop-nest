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
import { HeroSlidesService } from './hero-slides.service';
import { CreateHeroSlideDto } from './dto/create-hero-slide.dto';
import { UpdateHeroSlideDto } from './dto/update-hero-slide.dto';
import { FindHeroSlidesDto } from './dto/find-hero-slides.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { Locale } from '../common/decorators/locale.decorator';
import type { Locale as LocaleType } from '../common/types/translations.type';
import { resolveTranslation } from '../common/utils/resolve-translation.util';
import { HeroSlide } from './entities/hero-slide.entity';

// storefront-ისთვის resolveTranslation-ით ამოღებული eyebrow/title/
// description/buttonText emat-დება entity-ს `translations`-ის გვერდით
// (ორივე საჭიროა — resolved storefront-ისთვის, translations — admin-ის
// edit ფორმისთვის). მიბმული product-ის name/-იც იმავე სიღრმეზე
// resolve-დება, `buttonLink` არარსებობის შემთხვევაში frontend-ს product.id-
// იდან ლინკის თვითონ აწყობა შეეძლოს.
function enrichHeroSlide(heroSlide: HeroSlide, locale: LocaleType) {
  const resolved = resolveTranslation(heroSlide.translations, locale);
  return {
    ...heroSlide,
    eyebrow: resolved?.eyebrow,
    title: resolved?.title,
    description: resolved?.description,
    buttonText: resolved?.buttonText,
    ...(heroSlide.product
      ? {
          product: {
            ...heroSlide.product,
            name: resolveTranslation(heroSlide.product.translations, locale)
              ?.name,
          },
        }
      : {}),
  };
}

// storefront-ის GET /hero-slides საჯაროა, guard-ის გარეშე — category/
// products-ის იგივე პატერნი. Admin-ის სია/CRUD ADMIN როლს მოითხოვს.
// კატალოგის endpoint-ები per-IP rate limit-ს არ ექვემდებარება — იხ. AppModule.
@SkipThrottle()
@ApiTags('hero-slides')
@Controller('hero-slides')
export class HeroSlidesController {
  constructor(private readonly heroSlidesService: HeroSlidesService) {}

  @Get()
  @ApiOperation({
    summary: 'მთავარი გვერდის hero სლაიდერის აქტიური სლაიდები (storefront)',
  })
  @ApiResponse({ status: 200, description: 'აქტიური სლაიდების სია' })
  async findActive(@Locale() locale: LocaleType) {
    const heroSlides = await this.heroSlidesService.findActive();
    return heroSlides.map((heroSlide) => enrichHeroSlide(heroSlide, locale));
  }

  @Get('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'სლაიდების გვერდიანი სია, აქტიური/არააქტიურის ჩათვლით (ADMIN)',
  })
  @ApiResponse({ status: 200, description: 'სლაიდების გვერდიანი სია' })
  async findAllPaginated(
    @Query() findHeroSlidesDto: FindHeroSlidesDto,
    @Locale() locale: LocaleType,
  ) {
    const result =
      await this.heroSlidesService.findAllPaginated(findHeroSlidesDto);
    return {
      ...result,
      data: result.data.map((heroSlide) => enrichHeroSlide(heroSlide, locale)),
    };
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'კონკრეტული სლაიდის მიღება (ADMIN, edit ფორმისთვის)',
  })
  @ApiResponse({ status: 200, description: 'სლაიდი' })
  @ApiResponse({ status: 404, description: 'სლაიდი ვერ მოიძებნა' })
  findOne(@Param('id') id: string) {
    return this.heroSlidesService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'ახალი სლაიდის შექმნა (ADMIN)' })
  @ApiResponse({ status: 201, description: 'სლაიდი შეიქმნა' })
  @ApiResponse({ status: 400, description: 'ვალიდაციის შეცდომა' })
  @ApiResponse({ status: 404, description: 'პროდუქტი ვერ მოიძებნა' })
  create(@Body() createHeroSlideDto: CreateHeroSlideDto) {
    return this.heroSlidesService.create(createHeroSlideDto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'სლაიდის განახლება (ADMIN)' })
  @ApiResponse({ status: 200, description: 'სლაიდი განახლდა' })
  @ApiResponse({ status: 404, description: 'სლაიდი ან პროდუქტი ვერ მოიძებნა' })
  update(
    @Param('id') id: string,
    @Body() updateHeroSlideDto: UpdateHeroSlideDto,
  ) {
    return this.heroSlidesService.update(id, updateHeroSlideDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'სლაიდის წაშლა (ADMIN)' })
  @ApiResponse({ status: 200, description: 'სლაიდი წაიშალა' })
  @ApiResponse({ status: 404, description: 'სლაიდი ვერ მოიძებნა' })
  remove(@Param('id') id: string) {
    return this.heroSlidesService.remove(id);
  }
}
