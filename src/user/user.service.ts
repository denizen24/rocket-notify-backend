import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RocketChatService } from '../rocket-chat/rocket-chat.service';
import { User } from './user.types';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rocketChatService: RocketChatService,
  ) {}

  async findOrCreateTelegramUser(telegramId: string): Promise<User> {
    return this.prisma.user.upsert({
      where: { telegramId },
      update: {},
      create: { telegramId, enabled: true },
    }) as Promise<User>;
  }

  async updateRocketChatCreds(
    telegramId: string,
    server: string,
    user: string,
    pass: string,
  ): Promise<void> {
    try {
      const loginRes = await this.rocketChatService.login(server, user, pass);
      await this.prisma.user.update({
        where: { telegramId },
        data: {
          rcServer: server,
          rcUser: user,
          rcToken: loginRes.authToken,
          rcUserId: loginRes.userId,
          rcInstanceId: loginRes.instanceId,
        },
      });
      this.logger.log(
        `[✅ Обновлены креды Rocket.Chat для пользователя: ${telegramId}]`,
      );
    } catch (error) {
      this.logger.error(
        `[❌ Ошибка обновления кредов для ${telegramId}]`,
        error as Error,
      );
      throw error;
    }
  }

  async getAllEnabledUsers(): Promise<User[]> {
    return this.prisma.user.findMany({
      where: { enabled: true },
    }) as Promise<User[]>;
  }

  async updateLastUnread(userId: string, lastUnread: number): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { lastUnread },
    });
  }

  async toggleEnabled(telegramId: string, enabled: boolean): Promise<User> {
    return this.prisma.user.update({
      where: { telegramId },
      data: { enabled },
    }) as Promise<User>;
  }
}
