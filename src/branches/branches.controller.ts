import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  ParseIntPipe,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { BranchesService, BranchAvailabilityItem } from './branches.service';
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

  @Get('all')
  @ApiOperation({
    summary:
      'ყველა აქტიური ფილიალი pagination-ის გარეშე (ფილიალების გვერდი + რუკა)',
  })
  @ApiResponse({ status: 200, description: 'აქტიური ფილიალების სრული სია' })
  findAllForMap() {
    return this.branchesService.findAllForMap();
  }

  // `items` JSON მასივის ველების ნაკრები კალათის row-ების მიხედვით
  // დინამიკურია (variantId/colorId ორივე optional, ურთიერთგამომრიცხავი) —
  // ვერ დაიწერება როგორც სტატიკური DTO/query-param ტიპი, ამიტომ ვალიდაცია
  // ხელით ხდება (CategoryController-ის CategoryFiltersQuery-ის იგივე
  // accepted exception, იხ. CLAUDE.md).
  @Get('available')
  @ApiOperation({
    summary:
      'checkout-ისთვის — აქტიური ფილიალები, სადაც მოცემული ყველა კალათის item ერთდროულად ხელმისაწვდომია',
  })
  @ApiQuery({
    name: 'items',
    required: false,
    description:
      'JSON მასივი: [{"productId":1,"variantId":"uuid"},{"productId":2,"colorId":"uuid"},{"productId":3}]',
  })
  @ApiResponse({ status: 200, description: 'ხელმისაწვდომი ფილიალების სია' })
  findAvailable(@Query('items') itemsJson?: string) {
    return this.branchesService.findAvailableForProducts(
      this.parseAvailabilityItems(itemsJson),
    );
  }

  private parseAvailabilityItems(itemsJson?: string): BranchAvailabilityItem[] {
    if (!itemsJson) {
      return [];
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(itemsJson);
    } catch {
      throw new BadRequestException(
        'items ვერ დაიპარსა — მოსალოდნელია JSON მასივი',
      );
    }
    if (!Array.isArray(parsed)) {
      throw new BadRequestException('items უნდა იყოს მასივი');
    }

    return parsed.map((raw): BranchAvailabilityItem => {
      const productId = Number((raw as Record<string, unknown>)?.productId);
      if (!Number.isInteger(productId) || productId <= 0) {
        throw new BadRequestException(
          'items[].productId უნდა იყოს დადებითი მთელი რიცხვი',
        );
      }
      const variantId = (raw as Record<string, unknown>)?.variantId;
      const colorId = (raw as Record<string, unknown>)?.colorId;
      if (variantId !== undefined && typeof variantId !== 'string') {
        throw new BadRequestException('items[].variantId უნდა იყოს string');
      }
      if (colorId !== undefined && typeof colorId !== 'string') {
        throw new BadRequestException('items[].colorId უნდა იყოს string');
      }
      if (variantId && colorId) {
        throw new BadRequestException(
          'items[]-ს ერთდროულად ვერ ექნება variantId და colorId',
        );
      }
      return {
        productId,
        variantId: variantId,
        colorId: colorId,
      };
    });
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
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateBranchDto) {
    return this.branchesService.update(id, dto);
  }

  @Delete(':id')
  @AdminOnly()
  @ApiOperation({ summary: 'ფილიალის წაშლა (ADMIN)' })
  @ApiResponse({ status: 200, description: 'ფილიალი წაიშალა' })
  @ApiResponse({ status: 404, description: 'ფილიალი ვერ მოიძებნა' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.branchesService.remove(id);
  }
}
