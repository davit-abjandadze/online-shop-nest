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
import { AttributeService } from './attribute.service';
import { CreateAttributeDto } from './dto/create-attribute.dto';
import { UpdateAttributeDto } from './dto/update-attribute.dto';
import { FindAttributesDto } from './dto/find-attributes.dto';
import { CreateAttributeOptionDto } from './dto/create-attribute-option.dto';
import { UpdateAttributeOptionDto } from './dto/update-attribute-option.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { Locale } from '../common/decorators/locale.decorator';
import type { Locale as LocaleType } from '../common/types/translations.type';
import { resolveTranslation } from '../common/utils/resolve-translation.util';
import { Attribute } from './entities/attribute.entity';

// storefront-ისთვის resolveTranslation-ით ამოღებული `name` (და, options-ის
// შემთხვევაში, `value`) emat-დება entity-ს `translations`-ის გვერდით
// (ორივე საჭიროა — resolved storefront-ისთვის, translations — admin-ის
// edit ფორმისთვის).
function enrichAttribute(attribute: Attribute, locale: LocaleType) {
  return {
    ...attribute,
    name: resolveTranslation(attribute.translations, locale)?.name,
    options: (attribute.options ?? []).map((option) => ({
      ...option,
      value: resolveTranslation(option.translations, locale)?.value,
    })),
  };
}

// მკითხველი endpoint-ები (GET) საჯაროა — frontend-ის filter-sidebar-ს/admin
// ფორმას სჭირდება attribute-ების სია ავტორიზაციის გარეშეც (category
// მოდულის იგივე პატერნი). მხოლოდ create/update/delete მოითხოვს ADMIN როლს.
@ApiTags('attributes')
@Controller('attributes')
export class AttributeController {
  constructor(private readonly attributeService: AttributeService) {}

  @Get()
  @ApiOperation({ summary: 'მახასიათებლების გვერდიანი სია' })
  @ApiResponse({ status: 200, description: 'მახასიათებლების გვერდიანი სია' })
  async findAll(
    @Query() findAttributesDto: FindAttributesDto,
    @Locale() locale: LocaleType,
  ) {
    const result =
      await this.attributeService.findAllPaginated(findAttributesDto);
    return {
      ...result,
      data: result.data.map((attribute) => enrichAttribute(attribute, locale)),
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'კონკრეტული მახასიათებლის მიღება (options-ითურთ)' })
  @ApiResponse({ status: 200, description: 'მახასიათებელი' })
  @ApiResponse({ status: 404, description: 'მახასიათებელი ვერ მოიძებნა' })
  async findOne(@Param('id') id: string, @Locale() locale: LocaleType) {
    const attribute = await this.attributeService.findOne(id);
    return enrichAttribute(attribute, locale);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'ახალი მახასიათებლის შექმნა (ADMIN)' })
  @ApiResponse({ status: 201, description: 'მახასიათებელი შეიქმნა' })
  @ApiResponse({ status: 400, description: 'ვალიდაციის შეცდომა' })
  @ApiResponse({ status: 409, description: 'code უკვე დაკავებულია' })
  create(@Body() createAttributeDto: CreateAttributeDto) {
    return this.attributeService.create(createAttributeDto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'მახასიათებლის განახლება (ADMIN)' })
  @ApiResponse({ status: 200, description: 'მახასიათებელი განახლდა' })
  @ApiResponse({ status: 404, description: 'მახასიათებელი ვერ მოიძებნა' })
  update(
    @Param('id') id: string,
    @Body() updateAttributeDto: UpdateAttributeDto,
  ) {
    return this.attributeService.update(id, updateAttributeDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'მახასიათებლის წაშლა (ADMIN)' })
  @ApiResponse({ status: 200, description: 'მახასიათებელი წაიშალა' })
  @ApiResponse({ status: 404, description: 'მახასიათებელი ვერ მოიძებნა' })
  remove(@Param('id') id: string) {
    return this.attributeService.remove(id);
  }

  @Post(':id/options')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'მახასიათებელზე ახალი ოფციის დამატება (ADMIN)' })
  @ApiResponse({ status: 201, description: 'ოფცია დაემატა' })
  @ApiResponse({
    status: 400,
    description: 'ოფცია დასაშვებია მხოლოდ select/multi_select ტიპებზე',
  })
  @ApiResponse({
    status: 409,
    description: 'code უკვე დაკავებულია ამ მახასიათებელზე',
  })
  addOption(
    @Param('id') attributeId: string,
    @Body() createOptionDto: CreateAttributeOptionDto,
  ) {
    return this.attributeService.addOption(attributeId, createOptionDto);
  }

  @Put(':id/options/:optionId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'ოფციის განახლება (ADMIN)' })
  @ApiResponse({ status: 200, description: 'ოფცია განახლდა' })
  @ApiResponse({ status: 404, description: 'ოფცია ვერ მოიძებნა' })
  updateOption(
    @Param('id') attributeId: string,
    @Param('optionId') optionId: string,
    @Body() updateOptionDto: UpdateAttributeOptionDto,
  ) {
    return this.attributeService.updateOption(
      attributeId,
      optionId,
      updateOptionDto,
    );
  }

  @Delete(':id/options/:optionId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'ოფციის წაშლა (ADMIN)' })
  @ApiResponse({ status: 200, description: 'ოფცია წაიშალა' })
  @ApiResponse({ status: 404, description: 'ოფცია ვერ მოიძებნა' })
  removeOption(
    @Param('id') attributeId: string,
    @Param('optionId') optionId: string,
  ) {
    return this.attributeService.removeOption(attributeId, optionId);
  }
}
