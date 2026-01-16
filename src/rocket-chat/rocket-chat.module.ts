import { Module } from '@nestjs/common';
import { RocketChatService } from './rocket-chat.service';
import { RocketChatPollingService } from './rocket-chat.polling.service';
import { TelegramModule } from '../telegram/telegram.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule, TelegramModule],
  providers: [RocketChatService, RocketChatPollingService],
})
export class RocketChatModule {}
