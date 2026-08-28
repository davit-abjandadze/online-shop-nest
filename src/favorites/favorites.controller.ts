import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
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
import { FavoritesService } from './favorites.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

// ფავორიტები ყოველთვის "საკუთარი" ფავორიტებია — RolesGuard/@Roles აქ არ
// სჭირდება, cart-ის მსგავსად.
@ApiTags('favorites')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('favorites')
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Get()
  @ApiOperation({ summary: 'ჩემი ფავორიტების სია' })
  @ApiResponse({ status: 200, description: 'ფავორიტ პროდუქტების სია' })
  findAll(@CurrentUser() user: { userId: number }) {
    return this.favoritesService.findAllForUser(user.userId);
  }

  @Post(':productId')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'პროდუქტის დამატება ფავორიტებში' })
  @ApiResponse({ status: 201, description: 'დაემატა ფავორიტებში' })
  @ApiResponse({ status: 404, description: 'პროდუქტი ვერ მოიძებნა' })
  @ApiResponse({ status: 409, description: 'პროდუქტი უკვე ფავორიტებშია' })
  addFavorite(
    @CurrentUser() user: { userId: number },
    @Param('productId') productId: string,
  ) {
    return this.favoritesService.addFavorite(user.userId, +productId);
  }

  @Delete(':productId')
  @ApiOperation({ summary: 'პროდუქტის ამოშლა ფავორიტებიდან' })
  @ApiResponse({ status: 200, description: 'ამოშალა ფავორიტებიდან' })
  @ApiResponse({ status: 404, description: 'ფავორიტებში ვერ მოიძებნა' })
  removeFavorite(
    @CurrentUser() user: { userId: number },
    @Param('productId') productId: string,
  ) {
    return this.favoritesService.removeFavorite(user.userId, +productId);
  }
}
