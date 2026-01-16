import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError, AxiosInstance } from 'axios';

export interface UnreadCount {
  total: number;
  channels: number;
  im: number;
  groups: number;
}

@Injectable()
export class RocketChatService {
  private readonly logger = new Logger(RocketChatService.name);
  private readonly http: AxiosInstance;
  private readonly baseUrl: string;
  private readonly login: string;
  private readonly password: string;

  private authToken: string | null = null;
  private userId: string | null = null;
  private instanceId: string | null = null;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.getRequired('ROCKET_CHAT_URL').replace(/\/+$/, '');
    this.login = this.getRequired('ROCKET_CHAT_LOGIN');
    this.password = this.getRequired('ROCKET_CHAT_PASSWORD');

    this.http = axios.create({
      baseURL: this.baseUrl,
      timeout: 15000,
    });
  }

  async ensureAuthenticated(): Promise<void> {
    if (this.authToken && this.userId) {
      return;
    }
    await this.loginToRocketChat();
  }

  async getSubscriptions(): Promise<any[]> {
    await this.ensureAuthenticated();
    try {
      const response = await this.http.get('/api/v1/subscriptions.get', {
        headers: this.getAuthHeaders(),
      });
      const data = response.data ?? {};
      const subscriptions = data.subscriptions ?? data.update ?? [];
      return Array.isArray(subscriptions) ? subscriptions : [];
    } catch (error) {
      this.handleAuthError(error);
      throw error;
    }
  }

  async getUnreadCount(): Promise<UnreadCount> {
    const subscriptions = await this.getSubscriptions();
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

  private async loginToRocketChat(): Promise<void> {
    try {
      const response = await this.http.post(
        '/api/v1/login',
        {
          user: this.login,
          password: this.password,
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

      this.authToken = authToken;
      this.userId = userId;
      this.instanceId = instanceId ?? null;
      this.logger.log('Успешная авторизация в Rocket.Chat.');
    } catch (error) {
      this.logger.error('Ошибка авторизации в Rocket.Chat.', error as Error);
      throw error;
    }
  }

  private getAuthHeaders(): Record<string, string> {
    if (!this.authToken || !this.userId) {
      throw new Error('Not authenticated');
    }

    const headers: Record<string, string> = {
      'X-Auth-Token': this.authToken,
      'X-User-Id': this.userId,
      'Content-Type': 'application/json',
    };

    if (this.instanceId) {
      headers['X-Instance-Id'] = this.instanceId;
    }

    return headers;
  }

  private handleAuthError(error: unknown): void {
    if (!axios.isAxiosError(error)) {
      return;
    }

    const axiosError = error as AxiosError;
    if (axiosError.response?.status === 401) {
      this.clearAuth();
      this.logger.warn('Сессия Rocket.Chat истекла. Требуется повторная авторизация.');
    }
  }

  private clearAuth(): void {
    this.authToken = null;
    this.userId = null;
    this.instanceId = null;
  }

  private getRequired(key: string): string {
    const value = this.configService.get<string>(key);
    if (!value) {
      throw new Error(`Missing required env: ${key}`);
    }
    return value;
  }
}
