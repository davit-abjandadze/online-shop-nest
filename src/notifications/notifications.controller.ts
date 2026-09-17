import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AdminOnly } from '../common/decorators/admin-only.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';
import { NotificationsService } from './notifications.service';
import { notificationImageMulterOptions } from './utils/notification-image-storage.util';
import { UploadNotificationImageResponseDto } from './dto/upload-notification-image-response.dto';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { NotificationResponseDto } from './dto/notification-response.dto';

// ადმინის routes (გაგზავნა, ისტორია) — იხ. plans/NOTIFICATIONS_PLAN.md Phase B3.
@ApiTags('notifications-admin')
@Controller('admin/notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly configService: ConfigService,
  ) {}

  @Post('upload-image')
  @AdminOnly()
  @ApiOperation({
    summary: 'შეტყობინების rich-text ედიტორისთვის სურათის ატვირთვა (ADMIN)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { image: { type: 'string', format: 'binary' } },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'ატვირთული სურათის URL',
    type: UploadNotificationImageResponseDto,
  })
  @ApiResponse({ status: 400, description: 'დაუშვებელი ფაილის ტიპი/ზომა' })
  @UseInterceptors(FileInterceptor('image', notificationImageMulterOptions))
  uploadImage(
    @UploadedFile() file: Express.Multer.File,
  ): UploadNotificationImageResponseDto {
    if (!file) {
      throw new BadRequestException('სურათის ფაილი (image) აუცილებელია');
    }
    const backendUrl =
      this.configService.get<string>('BACKEND_URL') ?? 'http://localhost:5000';
    return { url: `${backendUrl}/uploads/notifications/${file.filename}` };
  }

  @Post()
  @AdminOnly()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'შეტყობინების გაგზავნა — ყველა user-ს ან კონკრეტულ user(ებ)-ს (ADMIN)',
  })
  @ApiResponse({
    status: 201,
    description: 'შეტყობინება გაიგზავნა',
    type: NotificationResponseDto,
  })
  @ApiResponse({ status: 400, description: 'ვალიდაციის შეცდომა' })
  create(
    @Body() createNotificationDto: CreateNotificationDto,
    @CurrentUser() user: { userId: number },
  ) {
    return this.notificationsService.create(createNotificationDto, user.userId);
  }

  @Get()
  @AdminOnly()
  @ApiOperation({
    summary: 'გაგზავნილი შეტყობინებების paginated ისტორია (ADMIN)',
  })
  @ApiResponse({ status: 200, description: 'შეტყობინებების გვერდიანი სია' })
  findAll(@Query() paginationDto: PaginationDto) {
    return this.notificationsService.findAllPaginated(paginationDto);
  }

  @Patch(':id')
  @AdminOnly()
  @ApiOperation({ summary: 'შეტყობინების რედაქტირება (ADMIN)' })
  @ApiResponse({
    status: 200,
    description: 'შეტყობინება განახლდა',
    type: NotificationResponseDto,
  })
  @ApiResponse({ status: 404, description: 'შეტყობინება ვერ მოიძებნა' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateNotificationDto: UpdateNotificationDto,
  ) {
    return this.notificationsService.update(id, updateNotificationDto);
  }

  @Delete(':id')
  @AdminOnly()
  @ApiOperation({ summary: 'შეტყობინების წაშლა (ADMIN)' })
  @ApiResponse({ status: 200, description: 'შეტყობინება წაიშალა' })
  @ApiResponse({ status: 404, description: 'შეტყობინება ვერ მოიძებნა' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.notificationsService.remove(id);
  }
}
