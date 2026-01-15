import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { TelegramService } from './telegram/telegram.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private telegram: TelegramService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('test-telegram')
  async testTelegram() {
    await this.telegram.sendMessage('🧪 Backend работает! Отправка из NestJS.');
    return { status: 'sent' };
  }
}
