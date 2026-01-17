import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger, Inject, forwardRef } from '@nestjs/common';
import { RocketChatService } from '../rocket-chat/rocket-chat.service';
import { TelegramService } from '../telegram/telegram.service';
import { UserService } from '../user/user.service';
import { User } from '../database/user.schema';

interface PollingJobData {
  user: {
    _id: string;
    telegramId: string;
    rcServer?: string;
    rcToken?: string;
    rcUserId?: string;
    rcInstanceId?: string;
    lastUnread: number;
  };
}

@Processor('polling')
export class PollingProcessor {
  private readonly logger = new Logger(PollingProcessor.name);

  constructor(
    private readonly rocketChatService: RocketChatService,
    private readonly telegramService: TelegramService,
    @Inject(forwardRef(() => UserService))
    private readonly userService: UserService,
  ) {}

  @Process('check-unread')
  async handleCheckUnread(job: Job<PollingJobData>) {
    const { user } = job.data;

    if (!user.rcServer || !user.rcToken || !user.rcUserId) {
      this.logger.warn(`[⚠️ Пользователь ${user.telegramId} не настроен]`);
      return;
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
        return;
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
        await this.userService.updateLastUnread(user._id, unread.total);
        this.logger.log(
          `[📱 Sent alert to ${user.telegramId}: unread=${unread.total}]`,
        );
      }
    } catch (error) {
      this.logger.error(
        `[❌ Polling failed for user ${user.telegramId}]`,
        error as Error,
      );
      throw error; // BullMQ повторит задачу при ошибке
    }
  }
}
