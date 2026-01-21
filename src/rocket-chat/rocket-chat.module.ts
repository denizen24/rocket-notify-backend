import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RocketChatService } from './rocket-chat.service';
import { RocketChatPollingService } from './rocket-chat.polling.service';
import { TelegramModule } from '../telegram/telegram.module';
import { UserModule } from '../user/user.module';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [
    ConfigModule,
    TelegramModule,
    forwardRef(() => UserModule),
    QueueModule,
  ],
  providers: [RocketChatService, RocketChatPollingService],
  exports: [RocketChatService],
})
export class RocketChatModule {}
