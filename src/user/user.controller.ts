import { Controller, Logger } from '@nestjs/common';
import { Ctx, Update, Command, Action, Message } from 'nestjs-telegraf';
import { Context } from 'telegraf';
import { UserService } from './user.service';

@Update()
@Controller()
export class UserController {
  private readonly logger = new Logger(UserController.name);

  constructor(private readonly userService: UserService) {}

  @Command('start')
  async start(@Ctx() ctx: Context) {
    const telegramId = ctx.from?.id.toString();
    if (!telegramId) {
      return;
    }

    await this.userService.findOrCreateTelegramUser(telegramId);
    await ctx.reply(
      '🚀 Подключи Rocket.Chat уведомления!\n\n' +
        'Используй команду:\n' +
        '/login <server> <user> <pass>\n\n' +
        'Пример:\n' +
        '/login https://rocketchat.medcontrol.cloud john pass123',
      {
        reply_markup: {
          inline_keyboard: [[{ text: '📝 Настроить', callback_data: 'setup' }]],
        },
      },
    );
  }

  @Command('login')
  async login(@Ctx() ctx: Context, @Message('text') text?: string) {
    const telegramId = ctx.from?.id.toString();
    if (!telegramId || !text) {
      return;
    }

    const args = text.split(' ').slice(1);
    if (args.length !== 3) {
      await ctx.reply('❌ Формат: /login <server> <user> <pass>');
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
      await ctx.reply('✅ Подписка создана! Уведомления будут приходить сюда.');
    } catch (e) {
      this.logger.error(`Ошибка авторизации для ${telegramId}`, e as Error);
      await ctx.reply('❌ Ошибка авторизации Rocket.Chat. Проверьте креды.');
    }
  }

  @Action('setup')
  async setup(@Ctx() ctx: Context) {
    await ctx.answerCbQuery();
    await ctx.reply(
      '📝 Для настройки используй команду:\n' +
        '/login <server> <user> <pass>\n\n' +
        'Пример:\n' +
        '/login https://rocketchat.medcontrol.cloud john pass123',
    );
  }
}
