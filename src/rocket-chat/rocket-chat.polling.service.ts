import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RocketChatService } from './rocket-chat.service';
import { TelegramService } from '../telegram/telegram.service';
import { UserService } from '../user/user.service';
import { QueueService } from '../queue/queue.service';

@Injectable()
export class RocketChatPollingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RocketChatPollingService.name);
  private intervalId: NodeJS.Timeout | null = null;
  private isChecking = false;
  private readonly intervalMs: number;

  constructor(
    private readonly rocketChatService: RocketChatService,
    private readonly telegramService: TelegramService,
    @Inject(forwardRef(() => UserService))
    private readonly userService: UserService,
    private readonly queueService: QueueService,
    private readonly configService: ConfigService,
  ) {
    // Получаем интервал из переменной окружения (в минутах), по умолчанию 5 минут
    const intervalMinStr = this.configService.get<string>('POLLING_INTERVAL_MIN', '5');
    const intervalMin = parseInt(intervalMinStr, 10) || 5;
    this.intervalMs = intervalMin * 60 * 1000;
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

    this.checkAllUsers().catch((error) => {
      this.logger.error('Ошибка первого цикла polling.', error as Error);
    });

    this.intervalId = setInterval(() => {
      this.checkAllUsers().catch((error) => {
        this.logger.error('Ошибка цикла polling.', error as Error);
      });
    }, this.intervalMs);

    this.logger.log('[🚀 Polling started]');
    this.logger.log(
      `Интервал: ${Math.round(this.intervalMs / 60000)} мин.`,
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

      // Если пользователей больше 20, используем очередь
      if (users.length > 20) {
        this.logger.log('[📦 Использование очереди для polling]');
        await this.queueService.schedulePollingForAllUsers(users);
        return;
      }

      // Для малого количества пользователей выполняем синхронно
      for (const user of users) {
        if (!user.rcServer || !user.rcToken || !user.rcUserId) {
          this.logger.warn(`[⚠️ Пользователь ${user.telegramId} не настроен]`);
          continue;
        }

        try {
          // Получаем расшифрованный токен
          const decryptedToken = await this.userService.getDecryptedToken(
            user.telegramId,
          );
          if (!decryptedToken) {
            this.logger.warn(
              `[⚠️ Не удалось расшифровать токен для ${user.telegramId}]`,
            );
            continue;
          }

          const unread = await this.rocketChatService.getUnreadCount(
            user.rcServer,
            decryptedToken,
            user.rcUserId,
            user.rcInstanceId ?? undefined,
          );

          this.logger.log(
            `[📊 User ${user.telegramId}: total=${unread.total}]`,
          );

          if (unread.total > user.lastUnread) {
            await this.telegramService.sendUnreadAlert(
              user.telegramId,
              unread.total,
            );
            await this.userService.updateLastUnread(
              user._id.toString(),
              unread.total,
            );
            this.logger.log(
              `[📱 Sent alert to ${user.telegramId}: unread=${unread.total}]`,
            );
          }
          if (user.lastUnread > 0 || unread.total === 0) {
            await this.userService.updateLastUnread(
              user._id.toString(),
              unread.total,
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
