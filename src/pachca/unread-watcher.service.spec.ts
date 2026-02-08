import { UnreadWatcher } from './unread-watcher.service';
import { PachcaApiClient } from './pachca.client';
import { TelegramService } from '../telegram/telegram.service';
import { ConfigService } from '@nestjs/config';

describe('UnreadWatcher', () => {
  const userId = 'user-1';
  const chatIds = 'chat-1';

  const createConfigService = (): ConfigService =>
    ({
      get: (key: string, defaultValue?: string) => {
        if (key === 'PACHCA_USER_ID') {
          return userId;
        }
        if (key === 'PACHCA_CHAT_IDS') {
          return chatIds;
        }
        if (key === 'PACHCA_POLLING_INTERVAL_MIN') {
          return defaultValue ?? '5';
        }
        return defaultValue ?? undefined;
      },
    }) as ConfigService;

  const createMocks = () => {
    const pachcaApiClient = {
      getChatMessages: jest.fn(),
      getMessageReaders: jest.fn(),
    } as unknown as PachcaApiClient;

    const telegramService = {
      sendMessage: jest.fn(),
    } as unknown as TelegramService;

    return { pachcaApiClient, telegramService };
  };

  it('sends notification when unread increases', async () => {
    const { pachcaApiClient, telegramService } = createMocks();
    pachcaApiClient.getChatMessages = jest.fn().mockResolvedValue([
      { id: 'm1', author_id: 'user-2' },
    ]);
    pachcaApiClient.getMessageReaders = jest.fn().mockResolvedValue([]);

    const watcher = new UnreadWatcher(
      pachcaApiClient,
      telegramService,
      createConfigService(),
    );

    await (watcher as any).checkChats();
    await (watcher as any).checkChats();

    expect(telegramService.sendMessage).toHaveBeenCalledTimes(1);
    expect(telegramService.sendMessage).toHaveBeenCalledWith(
      expect.stringContaining('Непрочитано: 1'),
    );
  });

  it('does not notify when all messages are read or authored by user', async () => {
    const { pachcaApiClient, telegramService } = createMocks();
    pachcaApiClient.getChatMessages = jest.fn().mockResolvedValue([
      { id: 'm1', author_id: userId },
    ]);
    pachcaApiClient.getMessageReaders = jest.fn().mockResolvedValue([
      { user_id: userId },
    ]);

    const watcher = new UnreadWatcher(
      pachcaApiClient,
      telegramService,
      createConfigService(),
    );

    await (watcher as any).checkChats();

    expect(telegramService.sendMessage).not.toHaveBeenCalled();
  });

  it('handles API errors without throwing', async () => {
    const { pachcaApiClient, telegramService } = createMocks();
    pachcaApiClient.getChatMessages = jest
      .fn()
      .mockRejectedValue(new Error('API error'));

    const watcher = new UnreadWatcher(
      pachcaApiClient,
      telegramService,
      createConfigService(),
    );

    await expect((watcher as any).checkChats()).resolves.toBeUndefined();
    expect(telegramService.sendMessage).not.toHaveBeenCalled();
  });
});
