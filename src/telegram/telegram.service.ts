import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class TelegramService {
  private readonly botToken: string;
  private readonly channelId: string;

  constructor(private configService: ConfigService) {
    this.botToken = this.getRequired('TELEGRAM_BOT_TOKEN');
    this.channelId = this.getRequired('TELEGRAM_CHANNEL_ID');
  }

  async sendMessage(text: string): Promise<void> {
    const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;

    await axios.post(url, {
      chat_id: this.channelId,
      text: text,
      parse_mode: 'HTML', // опционально: форматирование
    });
  }

  async sendUnreadAlert(unreadCount: number) {
    const message = `🚨 Rocket.Chat уведомления\n\n🔔 Непрочитано: ${unreadCount} 📩\n`;
    await this.sendMessage(message);
  }

  private getRequired(key: string): string {
    const value = this.configService.get<string>(key);
    if (!value) {
      throw new Error(`Missing required env: ${key}`);
    }
    return value;
  }
}
