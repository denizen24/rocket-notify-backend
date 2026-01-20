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

  // Настройка webhook middleware ДО запуска сервера
  // Это нужно, чтобы endpoint был зарегистрирован до того, как сервер начнет слушать
  const configService = app.get(ConfigService);
  const webhookUrl = configService.get<string>('TELEGRAM_WEBHOOK_URL');
  const webhookSecret = configService.get<string>('TELEGRAM_WEBHOOK_SECRET');

  if (webhookUrl && webhookSecret) {
    try {
      // Получаем бота после инициализации модулей
      // NestJS автоматически инициализирует модули при создании приложения
      const bot = app.get(getBotToken('RocketNotifyBot'));
      const webhookPath = '/webhook/rocketnotify';
      
      // Используем app.use() как указано в документации nestjs-telegraf
      // webhookCallback обрабатывает обновления и передает их в систему декораторов
      const webhookMiddleware = bot.webhookCallback(webhookPath, {
        secretToken: webhookSecret,
      });
      app.use(webhookMiddleware);
      Logger.log(`✅ Webhook middleware зарегистрирован: ${webhookPath}`);
      Logger.log(`🔐 Secret token: ${webhookSecret ? 'установлен' : 'не установлен'}`);
      Logger.log(`📡 Webhook URL должен быть: ${webhookUrl}${webhookPath}`);
    } catch (error) {
      Logger.error('❌ Ошибка настройки webhook middleware:', error);
      Logger.error('Детали ошибки:', (error as Error).stack);
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
