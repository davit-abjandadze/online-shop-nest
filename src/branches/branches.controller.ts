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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { BranchesService } from './branches.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { FindBranchesDto } from './dto/find-branches.dto';
import { AdminOnly } from '../common/decorators/admin-only.decorator';

// მკითხველი endpoint-ი (GET /branches) საჯაროა — checkout-ის "ფილიალიდან
// გატანა" სექციას ავტორიზაცია არ სჭირდება. Write ოპერაციები + სრული სია
// (დახურულების ჩათვლით) მხოლოდ ADMIN-ს ეკუთვნის — category მოდულის
// იგივე გამიჯვნა.
@ApiTags('branches')
@Controller('branches')
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Get()
  @ApiOperation({
    summary: 'აქტიური ფილიალების გვერდიანი სია (checkout-ისთვის)',
  })
  @ApiResponse({ status: 200, description: 'ფილიალების გვერდიანი სია' })
  findAll(@Query() dto: FindBranchesDto) {
    return this.branchesService.findAllActive(dto);
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
  @AdminOnly()
  @ApiOperation({
    summary: 'ყველა ფილიალის გვერდიანი სია, დახურულების ჩათვლით (ADMIN)',
  })
  @ApiResponse({ status: 200, description: 'ფილიალების გვერდიანი სია' })
  findAllAdmin(@Query() dto: FindBranchesDto) {
    return this.branchesService.findAllAdmin(dto);
  }

  @Post()
  @AdminOnly()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'ახალი ფილიალის დამატება (ADMIN)' })
  @ApiResponse({ status: 201, description: 'ფილიალი დაემატა' })
  create(@Body() dto: CreateBranchDto) {
    return this.branchesService.create(dto);
  }

  @Patch(':id')
  @AdminOnly()
  @ApiOperation({ summary: 'ფილიალის რედაქტირება (ADMIN)' })
  @ApiResponse({ status: 200, description: 'ფილიალი განახლდა' })
  @ApiResponse({ status: 404, description: 'ფილიალი ვერ მოიძებნა' })
  update(@Param('id') id: string, @Body() dto: UpdateBranchDto) {
    return this.branchesService.update(+id, dto);
  }

  @Delete(':id')
  @AdminOnly()
  @ApiOperation({ summary: 'ფილიალის წაშლა (ADMIN)' })
  @ApiResponse({ status: 200, description: 'ფილიალი წაიშალა' })
  @ApiResponse({ status: 404, description: 'ფილიალი ვერ მოიძებნა' })
  remove(@Param('id') id: string) {
    return this.branchesService.remove(+id);
  }
}
