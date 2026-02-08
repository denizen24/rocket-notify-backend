import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PachcaApiClient } from './pachca.client';
import { PachcaId } from './pachca.types';
import { TelegramService } from '../telegram/telegram.service';

@Injectable()
export class UnreadWatcher implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(UnreadWatcher.name);
  private readonly userId: string;
  private readonly intervalMs: number;
  private readonly chatIds: PachcaId[];
  private intervalId: NodeJS.Timeout | null = null;
  private isChecking = false;
  private lastUnreadTotal = 0;

  constructor(
    private readonly pachcaApiClient: PachcaApiClient,
    private readonly telegramService: TelegramService,
    private readonly configService: ConfigService,
  ) {
    this.userId = this.getRequired('PACHCA_USER_ID');

    const intervalMinStr = this.configService.get<string>(
      'PACHCA_POLLING_INTERVAL_MIN',
      '5',
    );
    const intervalMin = parseInt(intervalMinStr, 10) || 5;
    this.intervalMs = intervalMin * 60 * 1000;

    const chatIdsRaw = this.getRequired('PACHCA_CHAT_IDS');
    this.chatIds = this.parseChatIds(chatIdsRaw);
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

    this.checkChats().catch((error) => {
      this.logger.error('Ошибка первого цикла Pachca polling.', error as Error);
    });

    this.intervalId = setInterval(() => {
      this.checkChats().catch((error) => {
        this.logger.error('Ошибка цикла Pachca polling.', error as Error);
      });
    }, this.intervalMs);

    this.logger.log('[📨 Pachca polling started]');
    this.logger.log(`Интервал: ${Math.round(this.intervalMs / 60000)} мин.`);
  }

  private stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.logger.log('Pachca polling остановлен.');
  }

  private async checkChats(): Promise<void> {
    if (this.isChecking) {
      return;
    }
    this.isChecking = true;

    try {
      if (this.chatIds.length === 0) {
        this.logger.warn('PACHCA_CHAT_IDS пустой, polling не выполняется.');
        return;
      }

      let totalUnread = 0;
      const perChatCounts: Array<{ chatId: PachcaId; unread: number }> = [];

      for (const chatId of this.chatIds) {
        try {
          const messages = await this.pachcaApiClient.getChatMessages(chatId);
          let chatUnread = 0;

          for (const message of messages) {
            if (!message?.id) {
              continue;
            }
            if (
              message.author_id &&
              String(message.author_id) === String(this.userId)
            ) {
              continue;
            }

            const readers = await this.pachcaApiClient.getMessageReaders(
              chatId,
              message.id,
            );
            const isRead = readers.some(
              (reader) => String(reader.user_id) === String(this.userId),
            );
            if (!isRead) {
              chatUnread += 1;
            }
          }

          totalUnread += chatUnread;
          perChatCounts.push({ chatId, unread: chatUnread });
        } catch (error) {
          this.logger.error(
            `Ошибка обработки чата Pachca ${chatId}.`,
            error as Error,
          );
        }
      }

      if (totalUnread > this.lastUnreadTotal) {
        const details = perChatCounts
          .filter((entry) => entry.unread > 0)
          .map((entry) => `Чат ${entry.chatId}: ${entry.unread}`)
          .join('\n');
        const message =
          `🚨 Pachca уведомления\n\n` +
          `Непрочитано: ${totalUnread}\n` +
          (details ? `\n${details}` : '');

        await this.telegramService.sendMessage(message);
      }

      this.lastUnreadTotal = totalUnread;
    } finally {
      this.isChecking = false;
    }
  }

  private parseChatIds(rawValue: string): PachcaId[] {
    return rawValue
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
  }

  private getRequired(key: string): string {
    const value = this.configService.get<string>(key);
    if (!value) {
      throw new Error(`Missing required env: ${key}`);
    }
    return value;
  }
}
