import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TelegramModule } from './telegram/telegram.module';
import { ConfigModule } from '@nestjs/config';
import { RocketChatModule } from './rocket-chat/rocket-chat.module';
import { PachcaModule } from './pachca/pachca.module';

@Module({
  imports: [ConfigModule.forRoot(), TelegramModule, RocketChatModule, PachcaModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
