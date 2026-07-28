import { Controller, Post, Get, Delete, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { FavoriteService } from './favorite.service';
import { PaginationDto } from '../common/dto/pagination.dto';

@ApiTags('favorites')
@Controller('favorites')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class FavoriteController {
  constructor(private readonly favoriteService: FavoriteService) {}

  @Post(':questionId')
  @ApiOperation({ summary: 'კითხვის დამატება ფავორიტებში' })
  @ApiResponse({ status: 201, description: 'ფავორიტებში დაემატა' })
  @ApiResponse({ status: 409, description: 'უკვე ფავორიტებშია დამატებული' })
  addFavorite(@CurrentUser() user: any, @Param('questionId') questionId: string) {
    return this.favoriteService.addFavorite(user.userId, +questionId);
  }

  @Delete(':questionId')
  @ApiOperation({ summary: 'კითხვის წაშლა ფავორიტებიდან' })
  removeFavorite(@CurrentUser() user: any, @Param('questionId') questionId: string) {
    return this.favoriteService.removeFavorite(user.userId, +questionId);
  }

  @Get()
  @ApiOperation({ summary: 'ჩემი ფავორიტი კითხვები (pagination-ით)' })
  findMyFavorites(@CurrentUser() user: any, @Query() paginationDto: PaginationDto) {
    return this.favoriteService.findMyFavorites(user.userId, paginationDto);
  }
}
