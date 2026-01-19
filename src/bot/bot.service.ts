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
      { command: 'setup', description: '📝 Настроить Rocket.Chat' },
      { command: 'login', description: '🔑 Подключить Rocket.Chat (резервный)' },
      { command: 'stop', description: '⏸️ Отключить уведомления' },
    ]);
    const answer = await this.bot.telegram.getWebhookInfo();
    console.log('установленный вебхук = ', answer); 
    console.log('✅ Команды бота установлены!');
  }
}
