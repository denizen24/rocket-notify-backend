import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectBot } from 'nestjs-telegraf';
import { Telegraf } from 'telegraf';
import { ConfigService } from '@nestjs/config';
import {
  Ctx,
  Update,
  Command,
  Action,
  Message,
  Hears,
} from 'nestjs-telegraf';
import { Context } from 'telegraf';
import { UserService } from '../user/user.service';
import { LoginState } from '../user/login-state.interface';

@Update()
@Injectable()
export class BotService implements OnModuleInit {
  private readonly logger = new Logger(BotService.name);

  constructor(
    @InjectBot('RocketNotifyBot') private bot: Telegraf,
    private configService: ConfigService,
    private readonly userService: UserService,
  ) {}

  async onModuleInit() {
    // Устанавливаем команды бота
    await this.bot.telegram.setMyCommands([
      { command: 'start', description: '🚀 Запустить уведомления' },
      { command: 'setup', description: '📝 Настроить Rocket.Chat' },
      { command: 'login', description: '🔑 Подключить Rocket.Chat (резервный)' },
      { command: 'stop', description: '⏸️ Отключить уведомления' },
    ]);

    // Проверяем и устанавливаем webhook, если настроен
    const webhookUrl = this.configService.get<string>('TELEGRAM_WEBHOOK_URL');
    const webhookSecret = this.configService.get<string>(
      'TELEGRAM_WEBHOOK_SECRET',
    );

    if (webhookUrl && webhookSecret) {
      try {
        // Сначала удаляем существующий webhook (если был), чтобы избежать конфликтов
        await this.bot.telegram.deleteWebhook({ drop_pending_updates: false });

        // Устанавливаем webhook с правильным путем
        // Middleware уже настроен в main.ts на /webhook/rocketnotify
        const fullWebhookUrl = `${webhookUrl}/webhook/rocketnotify`;
        await this.bot.telegram.setWebhook(fullWebhookUrl, {
          secret_token: webhookSecret,
        });

        this.logger.log(`✅ Webhook настроен: ${fullWebhookUrl}`);
        // Бот не запускается в webhook режиме, так как обновления приходят через HTTP
      } catch (error) {
        this.logger.error('Ошибка установки webhook', error as Error);
      }
    } else {
      // Если webhook не настроен, удаляем его (если был установлен ранее) и запускаем polling
      try {
        await this.bot.telegram.deleteWebhook({ drop_pending_updates: true });
        // Запускаем бота в polling режиме
        await this.bot.launch();
        this.logger.log('✅ Бот запущен в polling режиме');
      } catch (error) {
        this.logger.error('Ошибка запуска бота', error as Error);
      }
    }
  }

  @Command('start')
  async start(@Ctx() ctx: Context) {
    const telegramId = ctx.from?.id.toString();
    if (!telegramId) {
      return;
    }

    await this.userService.findOrCreateTelegramUser(telegramId);

    const welcomeText = `
🚀 *Добро пожаловать в Rocket.Chat Notifier!*

Я буду отправлять уведомления о непрочитанных сообщениях из вашего Rocket.Chat прямо сюда.

*Начните настройку:*
`;

    await ctx.reply(welcomeText, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '📝 Настроить', callback_data: 'setup' }],
        ],
      },
    });
  }

  @Command('stop')
  async stop(@Ctx() ctx: Context) {
    const telegramId = ctx.from?.id.toString();
    if (!telegramId) {
      return;
    }

    try {
      await this.userService.toggleEnabled(telegramId, false);
      await ctx.reply(
        '⏸️ *Уведомления отключены*\n\nИспользуйте /start для повторной настройки.',
        { parse_mode: 'Markdown' },
      );
    } catch (error) {
      this.logger.error(
        `[❌ Ошибка отключения уведомлений для ${telegramId}]`,
        error as Error,
      );
      await ctx.reply('❌ Произошла ошибка. Попробуйте позже.');
    }
  }

  @Command('login')
  async login(@Ctx() ctx: Context, @Message('text') text?: string) {
    const telegramId = ctx.from?.id.toString();
    if (!telegramId || !text) {
      return;
    }

    const args = text.split(' ').slice(1);
    if (args.length !== 3) {
      await ctx.reply(
        '❌ *Неверный формат*\n\nИспользуйте: `/login <server> <user> <pass>`\n\n*Пример:*\n`/login https://rocketchat.example.com john pass123`',
        { parse_mode: 'Markdown' },
      );
      return;
    }

    const [server, user, pass] = args;

    try {
      await ctx.reply('⏳ Подключаюсь к Rocket.Chat...');
      await this.userService.updateRocketChatCreds(
        telegramId,
        server,
        user,
        pass,
      );
      await ctx.reply(
        '✅ *Подписка создана!*\n\nУведомления будут приходить сюда при появлении непрочитанных сообщений.',
        { parse_mode: 'Markdown' },
      );
    } catch (e) {
      this.logger.error(`Ошибка авторизации для ${telegramId}`, e as Error);
      await ctx.reply(
        '❌ *Ошибка авторизации*\n\nПроверьте правильность данных:\n• Сервер\n• Имя пользователя\n• Пароль',
        { parse_mode: 'Markdown' },
      );
    }
  }

  @Command('setup')
  async setupCommand(@Ctx() ctx: Context) {
    const telegramId = ctx.from?.id.toString();
    if (!telegramId) {
      return;
    }

    // Очищаем предыдущее состояние, если было
    await this.userService.clearLoginState(telegramId);

    // Устанавливаем начальное состояние мастера
    const initialState: LoginState = {
      step: 'server',
      createdAt: new Date(),
    };
    await this.userService.setLoginState(telegramId, initialState);

    const serverPrompt = `
📝 *Шаг 1 из 3: Сервер Rocket.Chat*

Введите URL вашего сервера Rocket.Chat.

*Пример:*
\`https://rocketchat.example.com\`

*Или:*
\`https://chat.company.com\`
`;

    await ctx.reply(serverPrompt, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '❌ Отменить', callback_data: 'cancel_setup' }],
        ],
      },
    });
  }

  @Action('setup')
  async setup(@Ctx() ctx: Context) {
    const telegramId = ctx.from?.id.toString();
    if (!telegramId) {
      return;
    }

    await ctx.answerCbQuery();

    // Очищаем предыдущее состояние, если было
    await this.userService.clearLoginState(telegramId);

    // Устанавливаем начальное состояние мастера
    const initialState: LoginState = {
      step: 'server',
      createdAt: new Date(),
    };
    await this.userService.setLoginState(telegramId, initialState);

    const serverPrompt = `
📝 *Шаг 1 из 3: Сервер Rocket.Chat*

Введите URL вашего сервера Rocket.Chat.

*Пример:*
\`https://rocketchat.example.com\`

*Или:*
\`https://chat.company.com\`
`;

    await ctx.reply(serverPrompt, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '❌ Отменить', callback_data: 'cancel_setup' }],
        ],
      },
    });
  }

  @Action('cancel_setup')
  async cancelSetup(@Ctx() ctx: Context) {
    const telegramId = ctx.from?.id.toString();
    if (!telegramId) {
      return;
    }

    await ctx.answerCbQuery();
    await this.userService.clearLoginState(telegramId);
    await ctx.reply('❌ Настройка отменена.');
  }

  @Hears(/^[^/].*/) // Ловит все текстовые сообщения, которые не начинаются с /
  async handleWizardStep(@Ctx() ctx: Context, @Message('text') text?: string) {
    const telegramId = ctx.from?.id.toString();
    if (!telegramId || !text) {
      return;
    }

    // Получаем текущее состояние мастера
    const loginState = await this.userService.getLoginState(telegramId);
    if (!loginState) {
      return; // Не в процессе настройки
    }

    try {
      switch (loginState.step) {
        case 'server': {
          // Валидация URL сервера
          let server = text.trim();
          if (!server.startsWith('http://') && !server.startsWith('https://')) {
            server = `https://${server}`;
          }

          try {
            new URL(server);
          } catch {
            await ctx.reply(
              '❌ *Неверный формат URL*\n\nВведите корректный URL сервера.\n\n*Пример:*\n`https://rocketchat.example.com`',
              { parse_mode: 'Markdown' },
            );
            return;
          }

          // Сохраняем server и переходим к следующему шагу
          await this.userService.updateLoginState(telegramId, {
            step: 'user',
            server,
          });

          const userPrompt = `
✅ *Сервер сохранен: ${server}*

📝 *Шаг 2 из 3: Имя пользователя*

Введите ваше имя пользователя Rocket.Chat.

*Пример:*
\`john.doe\`
`;

          await ctx.reply(userPrompt, {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '❌ Отменить', callback_data: 'cancel_setup' }],
              ],
            },
          });
          break;
        }

        case 'user': {
          const user = text.trim();
          if (!user) {
            await ctx.reply('❌ Имя пользователя не может быть пустым.');
            return;
          }

          // Сохраняем user и переходим к следующему шагу
          await this.userService.updateLoginState(telegramId, {
            step: 'pass',
            user,
          });

          const passPrompt = `
✅ *Имя пользователя сохранено: ${user}*

📝 *Шаг 3 из 3: Пароль*

Введите ваш пароль Rocket.Chat.

⚠️ *Сообщение с паролем будет автоматически удалено после обработки.*
`;

          await ctx.reply(passPrompt, {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '❌ Отменить', callback_data: 'cancel_setup' }],
              ],
            },
          });
          break;
        }

        case 'pass': {
          const pass = text.trim();
          if (!pass) {
            await ctx.reply('❌ Пароль не может быть пустым.');
            return;
          }

          // Удаляем сообщение с паролем для безопасности
          if (ctx.message && 'message_id' in ctx.message) {
            try {
              await ctx.deleteMessage(ctx.message.message_id);
            } catch (e) {
              this.logger.warn(
                `Не удалось удалить сообщение с паролем: ${e}`,
              );
            }
          }

          // Получаем полное состояние
          const fullState = await this.userService.getLoginState(telegramId);
          if (!fullState || !fullState.server || !fullState.user) {
            await ctx.reply(
              '❌ Ошибка: данные настройки потеряны. Начните заново с /start',
            );
            await this.userService.clearLoginState(telegramId);
            return;
          }

          // Показываем индикатор загрузки
          const loadingMsg = await ctx.reply('⏳ Подключаюсь к Rocket.Chat...');

          try {
            // Выполняем авторизацию
            await this.userService.updateRocketChatCreds(
              telegramId,
              fullState.server,
              fullState.user,
              pass,
            );

            // Удаляем индикатор загрузки
            try {
              await ctx.deleteMessage(loadingMsg.message_id);
            } catch (e) {
              // Игнорируем ошибку удаления
            }

            // Очищаем состояние мастера
            await this.userService.clearLoginState(telegramId);

            // Показываем успешное сообщение
            await ctx.reply(
              '✅ *Подписка создана!*\n\nУведомления будут приходить сюда при появлении непрочитанных сообщений в Rocket.Chat.\n\nИспользуйте `/stop` для отключения уведомлений.',
              { parse_mode: 'Markdown' },
            );
          } catch (error) {
            // Удаляем индикатор загрузки
            try {
              await ctx.deleteMessage(loadingMsg.message_id);
            } catch (e) {
              // Игнорируем ошибку удаления
            }

            this.logger.error(
              `Ошибка авторизации для ${telegramId}`,
              error as Error,
            );
            await ctx.reply(
              '❌ *Ошибка авторизации*\n\nПроверьте правильность данных:\n• Сервер\n• Имя пользователя\n• Пароль\n\nНачните заново с кнопки "📝 Настроить" в /start',
              { parse_mode: 'Markdown' },
            );
            await this.userService.clearLoginState(telegramId);
          }
          break;
        }
      }
    } catch (error) {
      this.logger.error(
        `Ошибка обработки шага мастера для ${telegramId}`,
        error as Error,
      );
      await ctx.reply('❌ Произошла ошибка. Попробуйте начать заново с /start');
      await this.userService.clearLoginState(telegramId);
    }
  }

}
