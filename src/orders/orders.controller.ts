import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { SearchOrderDto } from './dto/search-order.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../users/entities/user.entity';

// შენიშვნა: route-ი /admin/all მაღლა უნდა იდგეს /:id-ზე, თორემ Nest
// "admin"-ს :id პარამეტრად აღიქვამს (users.controller.ts-ის იგივე პატერნი).
@ApiTags('orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @ApiOperation({ summary: 'შეკვეთის შექმნა საკუთარი კალათიდან' })
  @ApiResponse({ status: 201, description: 'შეკვეთა შეიქმნა' })
  @ApiResponse({
    status: 400,
    description: 'კალათა ცარიელია ან არასაკმარისი მარაგი',
  })
  create(
    @CurrentUser() user: { userId: number },
    @Body() createOrderDto: CreateOrderDto,
  ) {
    return this.ordersService.createFromCart(user.userId, createOrderDto);
  }

  @Get()
  @ApiOperation({ summary: 'ჩემი შეკვეთების სია' })
  @ApiResponse({ status: 200, description: 'შეკვეთების გვერდიანი სია' })
  findMine(
    @CurrentUser() user: { userId: number },
    @Query() searchOrderDto: SearchOrderDto,
  ) {
    return this.ordersService.findAllForUser(user.userId, searchOrderDto);
  }

  @Get('admin/all')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'ყველა შეკვეთის სია (ADMIN)' })
  @ApiResponse({ status: 200, description: 'შეკვეთების გვერდიანი სია' })
  findAll(@Query() searchOrderDto: SearchOrderDto) {
    return this.ordersService.findAllPaginated(searchOrderDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'კონკრეტული შეკვეთის მიღება (საკუთარი ან ADMIN)' })
  @ApiResponse({ status: 200, description: 'შეკვეთა' })
  @ApiResponse({
    status: 403,
    description: 'სხვისი შეკვეთის ნახვის უფლება არ გაქვთ',
  })
  @ApiResponse({ status: 404, description: 'შეკვეთა ვერ მოიძებნა' })
  findOne(
    @CurrentUser() user: { userId: number; role: UserRole },
    @Param('id') id: string,
  ) {
    return this.ordersService.findOneForUser(user.userId, user.role, +id);
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'შეკვეთის სტატუსის განახლება (ADMIN)' })
  @ApiResponse({ status: 200, description: 'სტატუსი განახლდა' })
  @ApiResponse({ status: 404, description: 'შეკვეთა ვერ მოიძებნა' })
  updateStatus(
    @Param('id') id: string,
    @Body() updateOrderStatusDto: UpdateOrderStatusDto,
  ) {
    return this.ordersService.updateStatus(+id, updateOrderStatusDto.status);
  }
}
