import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { PachcaApiClient } from './pachca.client';
import { PachcaUnreadWatcher } from './unread-watcher.service';
import { TelegramModule } from '../telegram/telegram.module';

@Module({
  imports: [ConfigModule, HttpModule, TelegramModule],
  providers: [PachcaApiClient, PachcaUnreadWatcher],
  exports: [PachcaApiClient],
})
export class PachcaModule {}
