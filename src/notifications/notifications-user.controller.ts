import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';
import { NotificationsService } from './notifications.service';
import { NotificationDetailResponseDto } from './dto/notification-detail-response.dto';
import { UnreadCountResponseDto } from './dto/unread-count-response.dto';
import { MarkAllReadResponseDto } from './dto/mark-all-read-response.dto';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { NotificationListItemResponseDto } from './dto/notification-list-item-response.dto';

// user-facing routes (unread-count, სია, დეტალი+mark-as-read, read-all) —
// იხ. plans/NOTIFICATIONS_PLAN.md Phase B4. `unread-count` და `read-all`
// კონტროლერში `:id`-ზე ადრეა დეკლარირებული, რომ ისინი path param-ად არ ჩაითვალოს.
@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsUserController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('unread-count')
  @ApiOperation({ summary: 'წაუკითხავი შეტყობინებების რაოდენობა (bell badge)' })
  @ApiResponse({ status: 200, type: UnreadCountResponseDto })
  getUnreadCount(
    @CurrentUser() user: { userId: number },
  ): Promise<UnreadCountResponseDto> {
    return this.notificationsService.getUnreadCount(user.userId);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'ჩემი ყველა შეტყობინების მონიშვნა წაკითხულად' })
  @ApiResponse({ status: 200, type: MarkAllReadResponseDto })
  markAllRead(
    @CurrentUser() user: { userId: number },
  ): Promise<MarkAllReadResponseDto> {
    return this.notificationsService.markAllReadForUser(user.userId);
  }

  @Get()
  @ApiOperation({ summary: 'ჩემი შეტყობინებების paginated სია (dropdown)' })
  @ApiResponse({ status: 200, description: 'შეტყობინებების გვერდიანი სია' })
  findAll(
    @CurrentUser() user: { userId: number },
    @Query() paginationDto: PaginationDto,
  ): Promise<PaginatedResponseDto<NotificationListItemResponseDto>> {
    return this.notificationsService.findAllForUser(user.userId, paginationDto);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'შეტყობინების სრული content (მოდალი) + auto mark-as-read',
  })
  @ApiResponse({ status: 200, type: NotificationDetailResponseDto })
  @ApiResponse({ status: 404, description: 'შეტყობინება ვერ მოიძებნა' })
  findOne(
    @CurrentUser() user: { userId: number },
    @Param('id', ParseIntPipe) id: number,
  ): Promise<NotificationDetailResponseDto> {
    return this.notificationsService.findOneForUser(id, user.userId);
  }
}
