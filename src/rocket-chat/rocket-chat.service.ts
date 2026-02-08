import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

interface Subscription {
  t?: string;
  unread?: number;
  unreadCount?: number;
  msgs?: number;
  userMentions?: number;
  groupMentions?: number;
  tunread?: number;
}

export interface UnreadCount {
  total: number;
  channels: number;
  im: number;
  groups: number;
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

  async getSubscriptions(
    server: string,
    authToken: string,
    userId: string,
    instanceId?: string | null,
  ): Promise<Subscription[]> {
    const http = this.createHttpClient(server);
    try {
      const headers = this.getAuthHeaders(authToken, userId, instanceId);
      const response = await http.get<{
        subscriptions?: Subscription[];
        update?: Subscription[];
      }>('/api/v1/subscriptions.get', { headers });
      const data = response.data ?? {};
      const subscriptions = data.subscriptions ?? data.update ?? [];
      return Array.isArray(subscriptions) ? subscriptions : [];
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        this.logger.warn(
          'Сессия Rocket.Chat истекла. Требуется повторная авторизация.',
        );
      }
      throw error;
    }
  }

  async getUnreadCount(
    server: string,
    authToken: string,
    userId: string,
    instanceId?: string | null,
  ): Promise<UnreadCount> {
    const subscriptions = await this.getSubscriptions(
      server,
      authToken,
      userId,
      instanceId,
    );
    let channels = 0;
    let im = 0;
    let groups = 0;

    const toNumber = (value: unknown): number => {
      const numeric = Number(value);
      return Number.isFinite(numeric) ? numeric : 0;
    };

    subscriptions.forEach((sub: Subscription) => {
      const baseUnread = toNumber(
        sub.unread ?? sub.unreadCount ?? sub.msgs ?? 0,
      );
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
    instanceId?: string | null,
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
