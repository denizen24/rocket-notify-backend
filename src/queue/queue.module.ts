import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { QueueService } from './queue.service';
import { PollingProcessor } from './polling.processor';
import { UserModule } from '../user/user.module';
import { RocketChatModule } from '../rocket-chat/rocket-chat.module';
import { TelegramModule } from '../telegram/telegram.module';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const redisUrl =
          configService.get<string>('REDIS_URL') || 'redis://localhost:6379';

        return {
          redis: {
            url: redisUrl,
          },
        };
      },
      inject: [ConfigService],
    }),
    BullModule.registerQueue({
      name: 'polling',
    }),
    UserModule,
    RocketChatModule,
    TelegramModule,
  ],
  providers: [QueueService, PollingProcessor],
  exports: [QueueService, BullModule],
})
export class QueueModule {}
