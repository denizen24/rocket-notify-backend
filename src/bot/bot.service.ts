import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectBot } from 'nestjs-telegraf';
import { Telegraf } from 'telegraf';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class BotService implements OnModuleInit {
  constructor(
    @InjectBot('RocketNotifyBot') private bot: Telegraf,
    private configService: ConfigService,
  ) {}

  async onModuleInit() {
    // Устанавливаем команды бота
    await this.bot.telegram.setMyCommands([
      { command: 'start', description: '🚀 Запустить уведомления' },
      { command: 'setup', description: '📝 Настроить Rocket.Chat' },
      { command: 'login', description: '🔑 Подключить Rocket.Chat (резервный)' },
      { command: 'stop', description: '⏸️ Отключить уведомления' },
    ]);
    console.log('✅ Команды бота установлены!');

    // Проверяем и устанавливаем webhook, если настроен
    const webhookUrl = this.configService.get<string>('TELEGRAM_WEBHOOK_URL');
    const webhookSecret = this.configService.get<string>(
      'TELEGRAM_WEBHOOK_SECRET',
    );

    if (webhookUrl && webhookSecret) {
      try {
        // Устанавливаем webhook с правильным путем
        // Middleware уже настроен в main.ts на /webhook/rocketnotify
        const fullWebhookUrl = `${webhookUrl}/webhook/rocketnotify`;
        await this.bot.telegram.setWebhook(fullWebhookUrl, {
          secret_token: webhookSecret,
        });

        const webhookInfo = await this.bot.telegram.getWebhookInfo();
        console.log('🌐 Webhook установлен:', {
          url: webhookInfo.url,
          has_custom_certificate: webhookInfo.has_custom_certificate,
          pending_update_count: webhookInfo.pending_update_count,
        });
        console.log(`✅ Webhook настроен на: ${fullWebhookUrl}`);
        console.log('📡 Endpoint для обработки: POST /webhook/rocketnotify');
        // Бот не запускается в webhook режиме, так как обновления приходят через HTTP
      } catch (error) {
        console.error('❌ Ошибка установки webhook:', error);
      }
    } else {
      // Если webhook не настроен, удаляем его (если был установлен ранее) и запускаем polling
      try {
        await this.bot.telegram.deleteWebhook({ drop_pending_updates: true });
        console.log('📡 Webhook удален, запускается polling режим');
        // Запускаем бота в polling режиме
        await this.bot.launch();
        console.log('✅ Бот запущен в polling режиме');
      } catch (error) {
        console.error('❌ Ошибка запуска бота:', error);
      }
    }
  }
}
