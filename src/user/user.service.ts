import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserModel } from '../database/user.schema';
import { RocketChatService } from '../rocket-chat/rocket-chat.service';
import { CryptoService } from '../common/crypto.service';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @Inject(forwardRef(() => RocketChatService))
    private readonly rocketChatService: RocketChatService,
    private readonly cryptoService: CryptoService,
  ) {}

  async findOrCreateTelegramUser(telegramId: string): Promise<User> {
    let user = await this.userModel.findOne({ telegramId }).exec();
    if (!user) {
      user = await this.userModel.create({
        telegramId,
        enabled: true,
        intervalMin: 5,
        lastUnread: 0,
      });
    }
    return user;
  }

  async updateRocketChatCreds(
    telegramId: string,
    server: string,
    user: string,
    pass: string,
  ): Promise<void> {
    try {
      const loginRes = await this.rocketChatService.login(server, user, pass);
      
      // Шифруем токен перед сохранением
      const encryptedToken = this.cryptoService.encrypt(loginRes.authToken);

      await this.userModel
        .findOneAndUpdate(
          { telegramId },
          {
            rcServer: server,
            rcUser: user,
            rcToken: encryptedToken,
            rcUserId: loginRes.userId,
            rcInstanceId: loginRes.instanceId,
          },
          { new: true, upsert: false },
        )
        .exec();

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
    return this.userModel.find({ enabled: true }).exec();
  }

  async updateLastUnread(userId: string, lastUnread: number): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, { lastUnread }).exec();
  }

  async toggleEnabled(telegramId: string, enabled: boolean): Promise<User> {
    return this.userModel
      .findOneAndUpdate({ telegramId }, { enabled }, { new: true })
      .exec();
  }

  /**
   * Получает расшифрованный токен для пользователя
   */
  async getDecryptedToken(telegramId: string): Promise<string | null> {
    const user = await this.userModel.findOne({ telegramId }).exec();
    if (!user || !user.rcToken) {
      return null;
    }
    try {
      return this.cryptoService.decrypt(user.rcToken);
    } catch (error) {
      this.logger.error(
        `[❌ Ошибка расшифровки токена для ${telegramId}]`,
        error as Error,
      );
      return null;
    }
  }
}
