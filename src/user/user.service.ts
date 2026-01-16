import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RocketChatService } from '../rocket-chat/rocket-chat.service';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rocketChatService: RocketChatService,
  ) {}

  findOrCreateTelegramUser(telegramId: string) {
    return (this.prisma as any).user.upsert({
      where: { telegramId },
      update: {},
      create: { telegramId, enabled: true },
    });
  }

  async updateRocketChatCreds(
    telegramId: string,
    server: string,
    user: string,
    pass: string,
  ): Promise<void> {
    try {
      const loginRes = await this.rocketChatService.login(server, user, pass);
      await (this.prisma as any).user.update({
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

  async getAllEnabledUsers() {
    return (this.prisma as any).user.findMany({
      where: { enabled: true },
    });
  }

  async updateLastUnread(userId: string, lastUnread: number) {
    await (this.prisma as any).user.update({
      where: { id: userId },
      data: { lastUnread },
    });
  }

  async toggleEnabled(telegramId: string, enabled: boolean) {
    return (this.prisma as any).user.update({
      where: { telegramId },
      data: { enabled },
    });
  }
}
