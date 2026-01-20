import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import { getBotToken } from 'nestjs-telegraf';
import { ConfigService } from '@nestjs/config';
import * as express from 'express';

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
  
  // Включаем парсинг JSON body для Express (необходимо для webhook)
  // Это должно быть ДО регистрации webhook endpoint
  expressApp.use(express.json());
  expressApp.use(express.urlencoded({ extended: true }));

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
      
      // Используем expressApp.post() для явной регистрации POST endpoint
      // webhookCallback обрабатывает обновления и передает их в систему декораторов
      const webhookMiddleware = bot.webhookCallback(webhookPath, {
        secretToken: webhookSecret,
      });
      
      // Обертываем middleware для логирования
      // webhookCallback сам парсит body, поэтому мы логируем raw body до парсинга
      const loggingMiddleware = async (req: any, res: any, next: any) => {
        Logger.log(`📥 [WEBHOOK] Получен запрос на ${webhookPath}`);
        Logger.log(`📥 [WEBHOOK] Method: ${req.method}`);
        Logger.log(`📥 [WEBHOOK] Secret token в заголовке: ${req.headers['x-telegram-bot-api-secret-token']}`);
        
        // Собираем raw body для логирования (webhookCallback сам парсит его)
        const chunks: Buffer[] = [];
        const originalOn = req.on.bind(req);
        let bodyCollected = false;
        
        req.on = function(event: string, listener: any) {
          if (event === 'data' && !bodyCollected) {
            bodyCollected = true;
            return originalOn(event, (chunk: Buffer) => {
              chunks.push(chunk);
              Logger.log(`📥 [WEBHOOK] Получен chunk body, размер: ${chunk.length} байт`);
            });
          }
          if (event === 'end' && chunks.length > 0) {
            return originalOn(event, () => {
              const rawBody = Buffer.concat(chunks).toString('utf-8');
              Logger.log(`📥 [WEBHOOK] Raw body (${rawBody.length} символов): ${rawBody.substring(0, 500)}${rawBody.length > 500 ? '...' : ''}`);
              try {
                const parsedBody = JSON.parse(rawBody);
                Logger.log(`📥 [WEBHOOK] Parsed update: ${JSON.stringify(parsedBody, null, 2)}`);
              } catch (e) {
                Logger.warn(`⚠️ [WEBHOOK] Не удалось распарсить body как JSON: ${(e as Error).message}`);
              }
              listener();
            });
          }
          return originalOn(event, listener);
        };
        
        // Вызываем оригинальный middleware
        // webhookCallback сам парсит body и обрабатывает обновления
        try {
          await webhookMiddleware(req, res, next);
          Logger.log(`✅ [WEBHOOK] Middleware обработан успешно`);
        } catch (error) {
          Logger.error(`❌ [WEBHOOK] Ошибка в middleware:`, error);
          Logger.error(`❌ [WEBHOOK] Детали ошибки:`, (error as Error).stack);
          throw error;
        }
      };
      
      // Регистрируем POST endpoint через Express напрямую
      expressApp.post(webhookPath, loggingMiddleware);
      
      Logger.log(`✅ Webhook endpoint зарегистрирован: POST ${webhookPath}`);
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
