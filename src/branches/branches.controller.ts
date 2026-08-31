import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
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
import { BranchesService } from './branches.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

// მკითხველი endpoint-ი (GET /branches) საჯაროა — checkout-ის "ფილიალიდან
// გატანა" სექციას ავტორიზაცია არ სჭირდება. Write ოპერაციები + სრული სია
// (დახურულების ჩათვლით) მხოლოდ ADMIN-ს ეკუთვნის — category მოდულის
// იგივე გამიჯვნა.
@ApiTags('branches')
@Controller('branches')
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Get()
  @ApiOperation({ summary: 'აქტიური ფილიალების სია (checkout-ისთვის)' })
  @ApiResponse({ status: 200, description: 'ფილიალების სია' })
  findAll(@Query('companyId') companyId?: string) {
    return this.branchesService.findAllActive(companyId);
  }

  @Get('available')
  @ApiOperation({
    summary:
      'checkout-ისთვის — აქტიური ფილიალები, სადაც მოცემული ყველა პროდუქტი ერთდროულად ხელმისაწვდომია',
  })
  @ApiResponse({ status: 200, description: 'ხელმისაწვდომი ფილიალების სია' })
  findAvailable(@Query('productIds') productIds?: string) {
    const ids = (productIds ?? '')
      .split(',')
      .map((id) => Number(id.trim()))
      .filter((id) => Number.isInteger(id) && id > 0);
    return this.branchesService.findAvailableForProducts(ids);
  }

  @Get('admin/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'ყველა ფილიალის სია, დახურულების ჩათვლით (ADMIN)' })
  @ApiResponse({ status: 200, description: 'ფილიალების სია' })
  findAllAdmin(@Query('companyId') companyId?: string) {
    return this.branchesService.findAllAdmin(companyId);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'ახალი ფილიალის დამატება (ADMIN)' })
  @ApiResponse({ status: 201, description: 'ფილიალი დაემატა' })
  create(@Body() dto: CreateBranchDto) {
    return this.branchesService.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'ფილიალის რედაქტირება (ADMIN)' })
  @ApiResponse({ status: 200, description: 'ფილიალი განახლდა' })
  @ApiResponse({ status: 404, description: 'ფილიალი ვერ მოიძებნა' })
  update(@Param('id') id: string, @Body() dto: UpdateBranchDto) {
    return this.branchesService.update(+id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'ფილიალის წაშლა (ADMIN)' })
  @ApiResponse({ status: 200, description: 'ფილიალი წაიშალა' })
  @ApiResponse({ status: 404, description: 'ფილიალი ვერ მოიძებნა' })
  remove(@Param('id') id: string) {
    return this.branchesService.remove(+id);
  }
}
