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
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ColorsService } from './colors.service';
import { CreateColorDto } from './dto/create-color.dto';
import { UpdateColorDto } from './dto/update-color.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

// ფერების ბიბლიოთეკის ცალკე CRUD (ADMIN) — პროდუქტზე ფერების მიბმა/
// მარაგის მითითება products.controller.ts-შია (`/products/:id/colors`).
// მკითხველი endpoint-ები (GET) საჯაროა — admin-ის პროდუქტის ფორმას/
// frontend-ს სჭირდება ფერების სია ავტორიზაციის გარეშეც.
@ApiTags('colors')
@Controller('colors')
export class ColorsController {
  constructor(private readonly colorsService: ColorsService) {}

  @Get()
  @ApiOperation({ summary: 'ფერების სია' })
  @ApiResponse({ status: 200, description: 'ფერების სია' })
  findAll() {
    return this.colorsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'კონკრეტული ფერის მიღება' })
  @ApiResponse({ status: 200, description: 'ფერი' })
  @ApiResponse({ status: 404, description: 'ფერი ვერ მოიძებნა' })
  findOne(@Param('id') id: string) {
    return this.colorsService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'ახალი ფერის შექმნა (ADMIN)' })
  @ApiResponse({ status: 201, description: 'ფერი შეიქმნა' })
  @ApiResponse({ status: 400, description: 'ვალიდაციის შეცდომა' })
  create(@Body() createColorDto: CreateColorDto) {
    return this.colorsService.create(createColorDto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'ფერის განახლება (ADMIN)' })
  @ApiResponse({ status: 200, description: 'ფერი განახლდა' })
  @ApiResponse({ status: 404, description: 'ფერი ვერ მოიძებნა' })
  update(@Param('id') id: string, @Body() updateColorDto: UpdateColorDto) {
    return this.colorsService.update(id, updateColorDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'ფერის წაშლა (ADMIN)' })
  @ApiResponse({ status: 200, description: 'ფერი წაიშალა' })
  @ApiResponse({ status: 404, description: 'ფერი ვერ მოიძებნა' })
  remove(@Param('id') id: string) {
    return this.colorsService.remove(id);
  }
}
