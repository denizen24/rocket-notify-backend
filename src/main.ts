import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import { getBotToken } from 'nestjs-telegraf';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  // Настройка для работы за прокси (Tuna Tunnel)
  app.setGlobalPrefix('');
  app.enableCors();

  // Trust proxy для правильной обработки заголовков от Tuna Tunnel
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set('trust proxy', true);

  // Настройка webhook middleware для обработки запросов от Telegram
  const configService = app.get(ConfigService);
  const webhookUrl = configService.get<string>('TELEGRAM_WEBHOOK_URL');
  const webhookSecret = configService.get<string>('TELEGRAM_WEBHOOK_SECRET');

  if (webhookUrl && webhookSecret) {
    try {
      const bot = app.get(getBotToken('RocketNotifyBot'));
      const webhookPath = '/webhook/rocketnotify';
      expressApp.use(bot.webhookCallback(webhookPath));
      Logger.log(`✅ Webhook middleware настроен на: ${webhookPath}`);
    } catch (error) {
      Logger.error('❌ Ошибка настройки webhook middleware:', error);
    }
  }

  // Graceful shutdown
  const gracefulShutdown = async (signal: string) => {
    Logger.log(`📴 Получен сигнал ${signal}, завершение работы...`);
    try {
      await app.close();
      Logger.log('✅ Приложение корректно завершено');
      process.exit(0);
    } catch (error) {
      Logger.error('❌ Ошибка при завершении:', error);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => {
    void gracefulShutdown('SIGTERM');
  });
  process.on('SIGINT', () => {
    void gracefulShutdown('SIGINT');
  });

  const port = process.env.PORT ?? 3000;
  try {
    await app.listen(port);
    Logger.log(`🚀 Приложение запущено на порту ${port}`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EADDRINUSE') {
      Logger.error(
        `❌ Порт ${port} уже занят. Остановите другой процесс или используйте другой порт.`,
      );
      process.exit(1);
    }
    throw error;
  }
}
void bootstrap();
