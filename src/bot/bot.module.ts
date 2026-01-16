import { Module } from '@nestjs/common';
import { TelegrafModule } from 'nestjs-telegraf';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { session } from 'telegraf';
import { BotService } from './bot.service';
import { UserModule } from '../user/user.module';

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
        return {
          token,
          middlewares: [session()],
        };
      },
      inject: [ConfigService],
    }),
    UserModule, // Импортируем UserModule, чтобы UserController мог использовать декораторы nestjs-telegraf
  ],
  providers: [BotService], 
  exports: [BotService],
})
export class BotModule {}
