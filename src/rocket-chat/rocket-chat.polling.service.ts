import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { RocketChatService } from './rocket-chat.service';
import { TelegramService } from '../telegram/telegram.service';
import { UserService } from '../user/user.service';

@Injectable()
export class RocketChatPollingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RocketChatPollingService.name);
  private intervalId: NodeJS.Timeout | null = null;
  private isChecking = false;
  private readonly defaultIntervalMs = 5 * 60 * 1000; // 5 минут по умолчанию

  constructor(
    private readonly rocketChatService: RocketChatService,
    private readonly telegramService: TelegramService,
    private readonly userService: UserService,
  ) {}

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

    this.checkAllUsers().catch((error) => {
      this.logger.error('Ошибка первого цикла polling.', error as Error);
    });

    this.intervalId = setInterval(() => {
      this.checkAllUsers().catch((error) => {
        this.logger.error('Ошибка цикла polling.', error as Error);
      });
    }, this.defaultIntervalMs);

    this.logger.log('[🚀 Polling started]');
    this.logger.log(
      `Интервал: ${Math.round(this.defaultIntervalMs / 60000)} мин.`,
    );
  }

  private stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.logger.log('Polling остановлен.');
  }

  private async checkAllUsers(): Promise<void> {
    if (this.isChecking) {
      return;
    }
    this.isChecking = true;
    try {
      const users = await this.userService.getAllEnabledUsers();
      this.logger.log(`[📋 Проверка ${users.length} пользователей]`);

      for (const user of users) {
        if (!user.rcServer || !user.rcToken || !user.rcUserId) {
          this.logger.warn(`[⚠️ Пользователь ${user.telegramId} не настроен]`);
          continue;
        }

        try {
          const unread = await this.rocketChatService.getUnreadCount(
            user.rcServer,
            user.rcToken,
            user.rcUserId,
            user.rcInstanceId,
          );

          this.logger.log(
            `[📊 User ${user.telegramId}: total=${unread.total}]`,
          );

          if (unread.total > user.lastUnread) {
            await this.telegramService.sendUnreadAlert(
              user.telegramId,
              unread.total,
            );
            await this.userService.updateLastUnread(user.id, unread.total);
            this.logger.log(
              `[📱 Sent alert to ${user.telegramId}: unread=${unread.total}]`,
            );
          }
        } catch (error) {
          this.logger.error(
            `[❌ Polling failed for user ${user.telegramId}]`,
            error as Error,
          );
        }
      }
    } catch (error) {
      this.logger.error('Ошибка проверки пользователей.', error as Error);
    } finally {
      this.isChecking = false;
    }
  }
}
