import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { AppService } from './app.service';
import { UserService } from './user/user.service';
import { User } from './database/user.schema';

interface UserResponse {
  id: string;
  telegramId: string;
  rcServer: string | null;
  rcUser: string | null;
  enabled: boolean;
  lastUnread: number;
  createdAt: Date;
}

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly userService: UserService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('users')
  async getUsers(): Promise<UserResponse[]> {
    const users = await this.userService.getAllEnabledUsers();
    return users.map((u: User) => ({
      id: u._id.toString(),
      telegramId: u.telegramId,
      rcServer: u.rcServer ?? null,
      rcUser: u.rcUser ?? null,
      enabled: u.enabled,
      lastUnread: u.lastUnread,
      createdAt: u.createdAt,
    }));
  }

  @Post('users/:telegramId/enable')
  async toggleEnabled(
    @Param('telegramId') telegramId: string,
    @Body('enabled') enabled: boolean,
  ): Promise<UserResponse> {
    const user = await this.userService.toggleEnabled(telegramId, enabled);
    return {
      id: user._id.toString(),
      telegramId: user.telegramId,
      rcServer: user.rcServer ?? null,
      rcUser: user.rcUser ?? null,
      enabled: user.enabled,
      lastUnread: user.lastUnread,
      createdAt: user.createdAt,
    };
  }
}
