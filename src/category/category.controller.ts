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
import { CategoryService } from './category.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CategoryResponseDto } from './dto/category-response.dto';

@ApiTags('categories')
@Controller('categories')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Get()
  @ApiOperation({ summary: 'ყველა კატეგორიის მიღება' })
  @ApiResponse({ status: 200, description: 'კატეგორიების სია' })
  findAll() {
    return this.categoryService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'კონკრეტული კატეგორიის მიღება' })
  @ApiResponse({ status: 200, description: 'კატეგორია' })
  @ApiResponse({ status: 404, description: 'კატეგორია ვერ მოიძებნა' })
  findOne(@Param('id') id: string) {
    return this.categoryService.findOne(+id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'ახალი კატეგორიის შექმნა' })
  @ApiResponse({
    status: 201,
    description: 'კატეგორია შეიქმნა',
    type: CategoryResponseDto,
  })
  @ApiResponse({ status: 400, description: 'ვალიდაციის შეცდომა' })
  create(@Body() createCategoryDto: CreateCategoryDto) {
    return this.categoryService.create(createCategoryDto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'კატეგორიის განახლება' })
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
    return this.categoryService.update(+id, updateCategoryDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'კატეგორიის წაშლა' })
  @ApiResponse({ status: 200, description: 'კატეგორია წაიშალა' })
  @ApiResponse({ status: 404, description: 'კატეგორია ვერ მოიძებნა' })
  remove(@Param('id') id: string) {
    return this.categoryService.remove(+id);
  }
}
