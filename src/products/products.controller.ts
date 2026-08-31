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
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

// მოთვალთვალე/მოხმარებელი endpoint-ები (GET) საჯაროა, guard-ის გარეშე —
// კატეგორიის მსგავსად. მხოლოდ create/update/delete მოითხოვს ADMIN როლს.
@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @ApiOperation({ summary: 'პროდუქტების სია — ძიება, ფილტრები, პაგინაცია' })
  @ApiResponse({ status: 200, description: 'პროდუქტების გვერდიანი სია' })
  findAll(@Query() searchProductDto: SearchProductDto) {
    return this.productsService.findAllPaginated(searchProductDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'კონკრეტული პროდუქტის მიღება' })
  @ApiResponse({ status: 200, description: 'პროდუქტი' })
  @ApiResponse({ status: 404, description: 'პროდუქტი ვერ მოიძებნა' })
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(+id);
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
  getAttributeValues(@Param('id') id: string) {
    return this.productsService.getAttributeValues(+id);
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
  getColors(@Param('id') id: string) {
    return this.productsService.getColors(+id);
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
