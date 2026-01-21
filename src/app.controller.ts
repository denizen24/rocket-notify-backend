import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { AppService } from './app.service';
import { UserService } from './user/user.service';
import { User } from './database/user.schema';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { Document, Types } from 'mongoose';

interface UserWithId extends User, Document {
  _id: Types.ObjectId;
}

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
    @InjectConnection() private readonly mongoConnection: Connection,
    @InjectQueue('polling') private readonly pollingQueue: Queue,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('healthz')
  async healthCheck() {
    const mongoStatus =
      this.mongoConnection.readyState === 1 ? ('ok' as const) : ('error' as const);
    const redisStatus = await this.checkRedis();

    return {
      status: mongoStatus === 'ok' && redisStatus === 'ok' ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: {
        mongodb: mongoStatus,
        redis: redisStatus,
      },
    };
  }

  private async checkRedis(): Promise<'ok' | 'error'> {
    try {
      const client = this.pollingQueue.client;
      await client.ping();
      return 'ok';
    } catch {
      return 'error';
    }
  }

  @Get('users')
  async getUsers(): Promise<UserResponse[]> {
    const users = await this.userService.getAllEnabledUsers();
    return users.map((u: UserWithId) => ({
      id: u._id.toString(),
      telegramId: u.telegramId,
      rcServer: u.rcServer ?? null,
      rcUser: u.rcUser ?? null,
      enabled: u.enabled,
      lastUnread: u.lastUnread,
      createdAt: u.createdAt ?? new Date(),
    }));
  }

  @Post('users/:telegramId/enable')
  async toggleEnabled(
    @Param('telegramId') telegramId: string,
    @Body('enabled') enabled: boolean,
  ): Promise<UserResponse> {
    const user = (await this.userService.toggleEnabled(
      telegramId,
      enabled,
    )) as UserWithId;
    return {
      id: user._id.toString(),
      telegramId: user.telegramId,
      rcServer: user.rcServer ?? null,
      rcUser: user.rcUser ?? null,
      enabled: user.enabled,
      lastUnread: user.lastUnread,
      createdAt: user.createdAt ?? new Date(),
    };
  }
}
