import { Module } from '@nestjs/common';
import { TelegrafModule } from 'nestjs-telegraf';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { session } from 'telegraf';
import { BotService } from './bot.service';
import { UserModule } from '../user/user.module';
import { UserController } from '../user/user.controller';

@Module({
  imports: [
    TelegrafModule.forRootAsync({
      imports: [ConfigModule],
      botName: 'RocketNotifyBot',
      useFactory: (config: ConfigService) => {
        const token = config.get<string>('TELEGRAM_BOT_TOKEN');
        if (!token) {
          throw new Error('Missing required env: TELEGRAM_BOT_TOKEN');
        }

        const webhookUrl = config.get<string>('TELEGRAM_WEBHOOK_URL');
        const webhookSecret = config.get<string>('TELEGRAM_WEBHOOK_SECRET');

        // Базовая конфигурация бота
        const options: {
          token: string;
          middlewares: ReturnType<typeof session>[];
          launchOptions?: false | {
            webhook?: {
              domain: string;
              path: string;
              secretToken: string;
            };
          };
        } = {
          token,
          middlewares: [session()],
        };

        // Если webhook настроен, отключаем автоматический запуск
        // Webhook будет установлен вручную в BotService.onModuleInit()
        // Middleware будет настроен в main.ts
        if (webhookUrl && webhookSecret) {
          // Отключаем автоматический запуск, чтобы установить webhook вручную
          options.launchOptions = false;
          console.log(
            `🌐 Webhook будет настроен на: ${webhookUrl}`,
          );
        } else {
          console.log('📡 Используется polling режим (webhook не настроен)');
        }

        return options;
      },
      inject: [ConfigService],
    }),
    ConfigModule, // Добавляем ConfigModule для BotService
    UserModule, // Импортируем UserModule для UserService
  ],
  controllers: [UserController], // Регистрируем UserController в BotModule для работы с Telegraf
  providers: [BotService],
  exports: [BotService],
})
export class BotModule {}
