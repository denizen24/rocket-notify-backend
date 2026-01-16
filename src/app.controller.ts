import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { AppService } from './app.service';
import { UserService } from './user/user.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly userService: UserService
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('users')
  async getUsers() {
    const users = await this.userService.getAllEnabledUsers();
    return users.map((u) => ({
      id: u.id,
      telegramId: u.telegramId,
      rcServer: u.rcServer,
      rcUser: u.rcUser,
      enabled: u.enabled,
      lastUnread: u.lastUnread,
      createdAt: u.createdAt,
    }));
  }

  @Post('users/:telegramId/enable')
  async toggleEnabled(
    @Param('telegramId') telegramId: string,
    @Body('enabled') enabled: boolean
  ) {
    return this.userService.toggleEnabled(telegramId, enabled);
  }
}
