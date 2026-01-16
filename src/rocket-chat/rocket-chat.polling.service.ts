import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RocketChatService } from './rocket-chat.service';
import { TelegramService } from '../telegram/telegram.service';

@Injectable()
export class RocketChatPollingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RocketChatPollingService.name);
  private intervalId: NodeJS.Timeout | null = null;
  private lastUnreadTotal = 0;
  private isChecking = false;
  private readonly intervalMs: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly rocketChatService: RocketChatService,
    private readonly telegramService: TelegramService
  ) {
    const minutes = Number(this.configService.get('POLLING_INTERVAL_MIN', 5));
    this.intervalMs = Number.isFinite(minutes) && minutes > 0 ? minutes * 60 * 1000 : 5 * 60 * 1000;
  }

  onModuleInit(): void {
    this.start();
  }

  onModuleDestroy(): void {
    this.stop();
  }

  private start(): void {
    if (this.intervalId) {
      return;
    }

    this.checkUnread().catch((error) => {
      this.logger.error('Ошибка первого цикла polling.', error as Error);
    });

    this.intervalId = setInterval(() => {
      this.checkUnread().catch((error) => {
        this.logger.error('Ошибка цикла polling.', error as Error);
      });
    }, this.intervalMs);

    this.logger.log('[🚀 Polling started]');
    this.logger.log(`Интервал: ${Math.round(this.intervalMs / 60000)} мин.`);
  }

  private stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.logger.log('Polling остановлен.');
  }

  private async checkUnread(): Promise<void> {
    if (this.isChecking) {
      return;
    }
    this.isChecking = true;
    try {
      await this.rocketChatService.ensureAuthenticated();
      const unread = await this.rocketChatService.getUnreadCount();

      this.logger.log(
        `[📊 Unread: total=${unread.total}]`
      );

      if (unread.total > this.lastUnreadTotal) {
        await this.telegramService.sendUnreadAlert(unread.total);
        this.logger.log(`[📱 Sent alert: unread=${unread.total}]`);
      }

      this.lastUnreadTotal = unread.total;
    } catch (error) {
      this.logger.error('Ошибка проверки непрочитанных.', error as Error);
    } finally {
      this.isChecking = false;
    }
  }
}
