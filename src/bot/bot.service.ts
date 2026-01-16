import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectBot } from 'nestjs-telegraf';
import { Telegraf } from 'telegraf';

@Injectable()
export class BotService implements OnModuleInit {
  constructor(@InjectBot('RocketNotifyBot') private bot: Telegraf) {}

  async onModuleInit() {
    // ❌ Устанавливаем команды при старте
    await this.bot.telegram.setMyCommands([
      { command: 'start', description: '🚀 Запустить уведомления' },
      { command: 'login', description: '🔑 Подключить Rocket.Chat' },
      { command: 'status', description: '📊 Статус' },
      { command: 'help', description: '❓ Помощь' },
    ]);
    console.log('✅ Команды бота установлены!');
  }
}
