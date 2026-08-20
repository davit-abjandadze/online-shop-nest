import {
  Controller,
  Post,
  Param,
  UseGuards,
  Req,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../users/entities/user.entity';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post(':orderId/initiate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'BOG გადახდის დაწყება კონკრეტული შეკვეთისთვის' })
  @ApiResponse({
    status: 201,
    description: 'redirectUrl — მომხმარებელი აქ უნდა გადამისამართდეს',
  })
  @ApiResponse({
    status: 400,
    description: 'შეკვეთა უკვე გადახდილია ან PENDING არაა',
  })
  @ApiResponse({ status: 403, description: 'სხვისი შეკვეთაა' })
  initiate(
    @CurrentUser() user: { userId: number; role: UserRole },
    @Param('orderId') orderId: string,
  ) {
    return this.paymentsService.initiate(user.userId, user.role, +orderId);
  }

  // BOG არაა ავტორიზებული მომხმარებელი — ამ route-ზე JwtAuthGuard არ დგას,
  // დაცვა მხოლოდ ხელმოწერის ვერიფიკაციითაა (PaymentsService.handleCallback
  // 401/403-ს აგდებს არასწორ/არარსებულ Callback-Signature-ზე).
  @Post('callback/bog')
  @HttpCode(200)
  @ApiOperation({
    summary: 'BOG-ის გადახდის callback (არაავტორიზებული, ხელმოწერით დაცული)',
  })
  async bogCallback(@Req() req: Request) {
    // main.ts-ში rawBody: true ჩართულია — ვერიფიკაცია ზუსტად იმ ბაიტებზე
    // ხდება, რაც BOG-მა მოაწერა ხელი (არა ხელახლა-serialized JSON-ზე).
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
    await this.paymentsService.handleCallback(
      rawBody ?? Buffer.alloc(0),
      req.headers as Record<string, string>,
    );
    return { received: true };
  }
}
