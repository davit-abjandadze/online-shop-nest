import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
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
import { CompaniesService } from './companies.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

// მკითხველი endpoint-ი (GET /companies) საჯაროა — Branch/Category მოდულების
// იგივე გამიჯვნა: write ოპერაციები + სრული სია (დახურულების ჩათვლით)
// მხოლოდ ADMIN-ს ეკუთვნის.
@ApiTags('companies')
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get()
  @ApiOperation({ summary: 'აქტიური კომპანიების სია' })
  @ApiResponse({ status: 200, description: 'კომპანიების სია' })
  findAll() {
    return this.companiesService.findAllActive();
  }

  @Get('admin/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'ყველა კომპანიის სია, დახურულების ჩათვლით (ADMIN)' })
  @ApiResponse({ status: 200, description: 'კომპანიების სია' })
  findAllAdmin() {
    return this.companiesService.findAllAdmin();
  }

  @Get(':id')
  @ApiOperation({ summary: 'კონკრეტული კომპანიის მიღება' })
  @ApiResponse({ status: 200, description: 'კომპანია' })
  @ApiResponse({ status: 404, description: 'კომპანია ვერ მოიძებნა' })
  findOne(@Param('id') id: string) {
    return this.companiesService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'ახალი კომპანიის დამატება (ADMIN)' })
  @ApiResponse({ status: 201, description: 'კომპანია დაემატა' })
  create(@Body() dto: CreateCompanyDto) {
    return this.companiesService.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'კომპანიის რედაქტირება (ADMIN)' })
  @ApiResponse({ status: 200, description: 'კომპანია განახლდა' })
  @ApiResponse({ status: 404, description: 'კომპანია ვერ მოიძებნა' })
  update(@Param('id') id: string, @Body() dto: UpdateCompanyDto) {
    return this.companiesService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'კომპანიის წაშლა (ADMIN)' })
  @ApiResponse({ status: 200, description: 'კომპანია წაიშალა' })
  @ApiResponse({ status: 404, description: 'კომპანია ვერ მოიძებნა' })
  remove(@Param('id') id: string) {
    return this.companiesService.remove(id);
  }
}
