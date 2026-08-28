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
import { AddressesService } from './addresses.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

// მისამართები ყოველთვის "საკუთარი" მისამართებია — favorites/cart-ის
// მსგავსად RolesGuard/@Roles აქ არ სჭირდება.
@ApiTags('addresses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('addresses')
export class AddressesController {
  constructor(private readonly addressesService: AddressesService) {}

  @Get()
  @ApiOperation({ summary: 'ჩემი შენახული მისამართების სია' })
  @ApiResponse({ status: 200, description: 'მისამართების სია' })
  findAll(@CurrentUser() user: { userId: number }) {
    return this.addressesService.findAllForUser(user.userId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'ახალი მისამართის დამატება' })
  @ApiResponse({ status: 201, description: 'მისამართი დაემატა' })
  create(
    @CurrentUser() user: { userId: number },
    @Body() dto: CreateAddressDto,
  ) {
    return this.addressesService.create(user.userId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'მისამართის რედაქტირება' })
  @ApiResponse({ status: 200, description: 'მისამართი განახლდა' })
  @ApiResponse({ status: 404, description: 'მისამართი ვერ მოიძებნა' })
  update(
    @CurrentUser() user: { userId: number },
    @Param('id') id: string,
    @Body() dto: UpdateAddressDto,
  ) {
    return this.addressesService.update(user.userId, +id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'მისამართის წაშლა' })
  @ApiResponse({ status: 200, description: 'მისამართი წაიშალა' })
  @ApiResponse({ status: 404, description: 'მისამართი ვერ მოიძებნა' })
  remove(@CurrentUser() user: { userId: number }, @Param('id') id: string) {
    return this.addressesService.remove(user.userId, +id);
  }
}
