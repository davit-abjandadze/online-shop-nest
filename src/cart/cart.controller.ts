import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CartService } from './cart.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

// კალათა ყოველთვის "საკუთარი" კალათაა — RolesGuard/@Roles აქ არ სჭირდება,
// ადმინის ცნება კალათასთან საერთოდ არ არსებობს.
@ApiTags('cart')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  @ApiOperation({ summary: 'ჩემი კალათის მიღება (თუ არ არსებობს — იქმნება)' })
  @ApiResponse({ status: 200, description: 'კალათა' })
  getCart(@CurrentUser() user: { userId: number }) {
    return this.cartService.getOrCreateForUser(user.userId);
  }

  @Post('items')
  @ApiOperation({ summary: 'პროდუქტის დამატება კალათაში' })
  @ApiResponse({ status: 200, description: 'განახლებული კალათა' })
  @ApiResponse({ status: 400, description: 'არასაკმარისი მარაგი' })
  addItem(
    @CurrentUser() user: { userId: number },
    @Body() addCartItemDto: AddCartItemDto,
  ) {
    return this.cartService.addItem(
      user.userId,
      addCartItemDto.productId,
      addCartItemDto.quantity,
    );
  }

  @Patch('items/:id')
  @ApiOperation({ summary: 'კალათის ჩანაწერის რაოდენობის განახლება' })
  @ApiResponse({ status: 200, description: 'განახლებული კალათა' })
  @ApiResponse({ status: 404, description: 'ჩანაწერი ვერ მოიძებნა' })
  updateItem(
    @CurrentUser() user: { userId: number },
    @Param('id') id: string,
    @Body() updateCartItemDto: UpdateCartItemDto,
  ) {
    return this.cartService.updateItemQuantity(
      user.userId,
      +id,
      updateCartItemDto.quantity,
    );
  }

  @Delete('items/:id')
  @ApiOperation({ summary: 'ჩანაწერის წაშლა კალათიდან' })
  @ApiResponse({ status: 200, description: 'განახლებული კალათა' })
  @ApiResponse({ status: 404, description: 'ჩანაწერი ვერ მოიძებნა' })
  removeItem(@CurrentUser() user: { userId: number }, @Param('id') id: string) {
    return this.cartService.removeItem(user.userId, +id);
  }

  @Delete()
  @ApiOperation({ summary: 'მთელი კალათის გასუფთავება' })
  @ApiResponse({ status: 200, description: 'დაცარიელებული კალათა' })
  clearCart(@CurrentUser() user: { userId: number }) {
    return this.cartService.clear(user.userId);
  }
}
