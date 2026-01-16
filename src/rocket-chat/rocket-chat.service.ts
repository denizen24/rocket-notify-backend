import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosError, AxiosInstance } from 'axios';

export interface UnreadCount {
  total: number;
  channels: number;
  im: number;
  groups: number;
}

export interface LoginResult {
  authToken: string;
  userId: string;
  instanceId?: string | null;
}

@Injectable()
export class RocketChatService {
  private readonly logger = new Logger(RocketChatService.name);

  private createHttpClient(baseUrl: string): AxiosInstance {
    return axios.create({
      baseURL: baseUrl.replace(/\/+$/, ''),
      timeout: 15000,
    });
  }

  async login(server: string, user: string, password: string): Promise<LoginResult> {
    const http = this.createHttpClient(server);
    try {
      const response = await http.post(
        '/api/v1/login',
        {
          user,
          password,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const authToken =
        response.headers['x-auth-token'] ??
        response.data?.data?.authToken ??
        response.data?.authToken ??
        response.data?.data?.['X-Auth-Token'] ??
        response.data?.['X-Auth-Token'];
      const userId =
        response.headers['x-user-id'] ??
        response.data?.data?.userId ??
        response.data?.userId ??
        response.data?.data?.['X-User-Id'] ??
        response.data?.['X-User-Id'];
      const instanceId =
        response.headers['x-instance-id'] ??
        response.data?.data?.instanceId ??
        response.data?.instanceId;

      if (!authToken || !userId) {
        this.logger.error('Не получены токены авторизации от Rocket.Chat.');
        throw new Error('Rocket.Chat login failed: missing auth headers');
      }

      const userLabel = typeof userId === 'string' ? userId.slice(0, 6) : 'unknown';
      this.logger.log(`[✅ Авторизован в Rocket.Chat: ${userLabel}]`);

      return {
        authToken,
        userId,
        instanceId: instanceId ?? null,
      };
    } catch (error) {
      this.logger.error('Ошибка авторизации в Rocket.Chat.', error as Error);
      throw error;
    }
  }

  async getSubscriptions(
    server: string,
    authToken: string,
    userId: string,
    instanceId?: string | null
  ): Promise<any[]> {
    const http = this.createHttpClient(server);
    try {
      const headers = this.getAuthHeaders(authToken, userId, instanceId);
      const response = await http.get('/api/v1/subscriptions.get', { headers });
      const data = response.data ?? {};
      const subscriptions = data.subscriptions ?? data.update ?? [];
      return Array.isArray(subscriptions) ? subscriptions : [];
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        this.logger.warn('Сессия Rocket.Chat истекла. Требуется повторная авторизация.');
      }
      throw error;
    }
  }

  async getUnreadCount(
    server: string,
    authToken: string,
    userId: string,
    instanceId?: string | null
  ): Promise<UnreadCount> {
    const subscriptions = await this.getSubscriptions(server, authToken, userId, instanceId);
    let channels = 0;
    let im = 0;
    let groups = 0;

    const toNumber = (value: unknown): number => {
      const numeric = Number(value);
      return Number.isFinite(numeric) ? numeric : 0;
    };

    subscriptions.forEach((sub: any) => {
      const baseUnread = toNumber(sub.unread ?? sub.unreadCount ?? sub.msgs ?? 0);
      const mentionUnread =
        toNumber(sub.userMentions ?? 0) + toNumber(sub.groupMentions ?? 0);
      const threadUnread = toNumber(sub.tunread ?? 0);
      const totalUnread = baseUnread + mentionUnread + threadUnread;

      if (sub.t === 'c') {
        channels += totalUnread;
      } else if (sub.t === 'd') {
        im += totalUnread;
      } else if (sub.t === 'p') {
        groups += totalUnread;
      }
    });

    return {
      total: channels + im + groups,
      channels,
      im,
      groups,
    };
  }

  private getAuthHeaders(
    authToken: string,
    userId: string,
    instanceId?: string | null
  ): Record<string, string> {
    const headers: Record<string, string> = {
      'X-Auth-Token': authToken,
      'X-User-Id': userId,
      'Content-Type': 'application/json',
    };

    if (instanceId) {
      headers['X-Instance-Id'] = instanceId;
    }

    return headers;
  }
}
