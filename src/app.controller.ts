import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import { AppService } from './app.service';

@ApiTags('health')
@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  // load balancer-ის/orchestrator-ის (Docker/PM2/k8s) health probe — 200
  // მხოლოდ მაშინ, როცა ბაზაც პასუხობს; თორემ 503, რომ ინსტანსი ტრაფიკიდან
  // ამოიღონ. rate limit-ს არ ექვემდებარება (probe ხშირად ეშვება ერთი IP-დან).
  @Get('health')
  @SkipThrottle()
  @ApiOperation({ summary: 'აპლიკაციისა და ბაზის მდგომარეობა' })
  @ApiResponse({ status: 200, description: 'ყველაფერი მუშაობს' })
  @ApiResponse({ status: 503, description: 'ბაზა მიუწვდომელია' })
  async health(): Promise<{ status: 'ok'; db: 'up' }> {
    try {
      await this.dataSource.query('SELECT 1');
    } catch {
      throw new ServiceUnavailableException({ status: 'error', db: 'down' });
    }
    return { status: 'ok', db: 'up' };
  }
}
