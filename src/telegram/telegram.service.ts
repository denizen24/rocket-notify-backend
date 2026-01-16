import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private readonly botToken: string;

  constructor(private readonly configService: ConfigService) {
    this.botToken = this.getRequired('TELEGRAM_BOT_TOKEN');
  }

  async sendToUser(chatId: string, text: string): Promise<void> {
    const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;

    try {
      await axios.post(url, {
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML',
      });
      this.logger.log(`[📱 Отправлено сообщение пользователю: ${chatId}]`);
    } catch (error) {
      this.logger.error(`[❌ Ошибка отправки сообщения пользователю ${chatId}]`, error as Error);
      throw error;
    }
  }

  async sendUnreadAlert(chatId: string, unreadCount: number, mentions?: number) {
    let message = `🚨 Rocket.Chat уведомления\n\n🔔 Непрочитано: ${unreadCount} 📩\n`;
    if (mentions !== undefined && mentions > 0) {
      message += `💬 Упоминаний: ${mentions}\n`;
    }
    await this.sendToUser(chatId, message);
  }

  private getRequired(key: string): string {
    const value = this.configService.get<string>(key);
    if (!value) {
      throw new Error(`Missing required env: ${key}`);
    }
    return value;
  }
}
