import { Module, forwardRef } from '@nestjs/common';
import { RocketChatService } from './rocket-chat.service';
import { RocketChatPollingService } from './rocket-chat.polling.service';
import { TelegramModule } from '../telegram/telegram.module';
import { PrismaModule } from '../prisma/prisma.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [TelegramModule, PrismaModule, forwardRef(() => UserModule)],
  providers: [RocketChatService, RocketChatPollingService],
  exports: [RocketChatService],
})
export class RocketChatModule {}
