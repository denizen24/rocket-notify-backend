import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { MongoModule } from './database/mongo.module';
import { BotModule } from './bot/bot.module';
import { TelegramModule } from './telegram/telegram.module';
import { RocketChatModule } from './rocket-chat/rocket-chat.module';
import { UserModule } from './user/user.module';
import { QueueModule } from './queue/queue.module';

@Module({
  imports: [
    ConfigModule.forRoot(),
    MongoModule, // MongoDB вместо Prisma
    QueueModule, // BullMQ для очередей
    BotModule,
    TelegramModule,
    RocketChatModule,
    UserModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
