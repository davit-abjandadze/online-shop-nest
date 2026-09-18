import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  ParseUUIDPipe,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { FindCompaniesDto } from './dto/find-companies.dto';
import { AdminOnly } from '../common/decorators/admin-only.decorator';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../users/entities/user.entity';
import { isAdminUser } from '../common/utils/is-admin.util';

// მკითხველი endpoint-ი (GET /companies) საჯაროა — Branch/Category მოდულების
// იგივე გამიჯვნა: write ოპერაციები + სრული სია (დახურულების ჩათვლით)
// მხოლოდ ADMIN-ს ეკუთვნის.
@ApiTags('companies')
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get()
  @ApiOperation({ summary: 'აქტიური კომპანიების გვერდიანი სია' })
  @ApiResponse({ status: 200, description: 'კომპანიების გვერდიანი სია' })
  findAll(@Query() dto: FindCompaniesDto) {
    return this.companiesService.findAllActive(dto);
  }

  @Get('admin/all')
  @AdminOnly()
  @ApiOperation({
    summary: 'ყველა კომპანიის გვერდიანი სია, დახურულების ჩათვლით (ADMIN)',
  })
  @ApiResponse({ status: 200, description: 'კომპანიების გვერდიანი სია' })
  findAllAdmin(@Query() dto: FindCompaniesDto) {
    return this.companiesService.findAllAdmin(dto);
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'კონკრეტული კომპანიის მიღება' })
  @ApiResponse({ status: 200, description: 'კომპანია' })
  @ApiResponse({ status: 404, description: 'კომპანია ვერ მოიძებნა' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user?: { role: UserRole },
  ) {
    const isAdmin = isAdminUser(user);
    return this.companiesService.findOne(id, isAdmin);
  }

  @Post()
  @AdminOnly()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'ახალი კომპანიის დამატება (ADMIN)' })
  @ApiResponse({ status: 201, description: 'კომპანია დაემატა' })
  create(@Body() dto: CreateCompanyDto) {
    return this.companiesService.create(dto);
  }

  @Patch(':id')
  @AdminOnly()
  @ApiOperation({ summary: 'კომპანიის რედაქტირება (ADMIN)' })
  @ApiResponse({ status: 200, description: 'კომპანია განახლდა' })
  @ApiResponse({ status: 404, description: 'კომპანია ვერ მოიძებნა' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCompanyDto,
  ) {
    return this.companiesService.update(id, dto);
  }

  @Delete(':id')
  @AdminOnly()
  @ApiOperation({ summary: 'კომპანიის წაშლა (ADMIN)' })
  @ApiResponse({ status: 200, description: 'კომპანია წაიშალა' })
  @ApiResponse({ status: 404, description: 'კომპანია ვერ მოიძებნა' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.companiesService.remove(id);
  }
}
