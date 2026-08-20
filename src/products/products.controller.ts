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
}
