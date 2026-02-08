import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';
import {
  PachcaChat,
  PachcaId,
  PachcaListResponse,
  PachcaMessage,
  PachcaReader,
  PachcaUnreadIdsResponse,
} from './pachca.types';

@Injectable()
export class PachcaApiClient {
  private readonly logger = new Logger(PachcaApiClient.name);
  private readonly baseUrl: string;
  private readonly accessToken: string;
  private readonly internalBaseUrl: string;
  private readonly internalCookie: string | null;
  private readonly maxRetries = 3;
  private readonly baseDelayMs = 300;
  private readonly logLevel: PachcaLogLevel;

  private static readonly levelOrder: Record<PachcaLogLevel, number> = {
    debug: 10,
    info: 20,
    warn: 30,
    error: 40,
    none: 100,
  };

  constructor(
    private readonly http: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl = this.getRequired('PACHCA_BASE_URL').replace(/\/+$/, '');
    this.accessToken = this.getRequired('PACHCA_ACCESS_TOKEN');
    this.internalBaseUrl = this.configService
      .get<string>('PACHCA_INTERNAL_BASE_URL', 'https://app.pachca.com/api/v3')
      .replace(/\/+$/, '');
    this.internalCookie = this.getInternalCookie();
    this.logLevel = this.getLogLevel();
  }

  async getChats(): Promise<PachcaChat[]> {
    return this.requestList<PachcaChat>('/chats');
  }

  async getChatMessages(
    chatId: PachcaId,
    limit = 30,
  ): Promise<PachcaMessage[]> {
    return this.requestList<PachcaMessage>(`/chats/${chatId}/messages`, {
      limit,
    });
  }

  async getMessageReaders(
    chatId: PachcaId,
    messageId: PachcaId,
  ): Promise<PachcaReader[]> {
    return this.requestList<PachcaReader>(
      `/chats/${chatId}/messages/${messageId}/readers`,
    );
  }

  async getUnreadChatIds(): Promise<PachcaId[]> {
    if (!this.internalCookie) {
      throw new Error('Missing internal Pachca auth cookie');
    }
    return this.requestInternalUnreadIds();
  }

  canUseInternalApi(): boolean {
    return Boolean(this.internalCookie);
  }

  private async requestList<T>(
    path: string,
    params?: Record<string, string | number>,
  ): Promise<T[]> {
    const response = await this.requestWithRetry(async () => {
      const url = `${this.baseUrl}${path}`;
      const { data } = await lastValueFrom(
        this.http.get<PachcaListResponse<T> | T[]>(url, {
          params,
          headers: this.getAuthHeaders(),
        }),
      );
      return data;
    });

    const list = Array.isArray(response)
      ? response
      : response?.data ?? response?.items ?? [];
    this.logResponse(path, list);
    return list;
  }

  private async requestInternalUnreadIds(): Promise<PachcaId[]> {
    const path = '/chats/unread_ids';
    const response = await this.requestWithRetry(async () => {
      const url = `${this.internalBaseUrl}${path}`;
      const { data } = await lastValueFrom(
        this.http.get<PachcaUnreadIdsResponse | PachcaId[]>(url, {
          headers: this.getInternalHeaders(),
        }),
      );
      return data;
    });

    const list = Array.isArray(response) ? response : response?.data ?? [];
    this.logResponse(`internal${path}`, list);
    return list;
  }

  private async requestWithRetry<T>(request: () => Promise<T>): Promise<T> {
    let attempt = 0;
    let delayMs = this.baseDelayMs;

    while (true) {
      try {
        return await request();
      } catch (error) {
        attempt += 1;
        if (attempt > this.maxRetries) {
          throw error;
        }
        if (this.shouldLog('warn')) {
          this.logger.warn(
            `Ошибка запроса к Pachca, попытка ${attempt} из ${this.maxRetries}.`,
          );
        }
        await this.delay(delayMs);
        delayMs *= 2;
      }
    }
  }

  private getAuthHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
    };
  }

  private getInternalHeaders(): Record<string, string> {
    if (!this.internalCookie) {
      throw new Error('Missing internal Pachca auth cookie');
    }
    return {
      Cookie: this.internalCookie,
      'Content-Type': 'application/json',
    };
  }

  private logResponse(path: string, payload: unknown): void {
    if (!this.shouldLog('debug')) {
      return;
    }
    const serialized = this.safeSerialize(payload, 2000);
    this.logger.debug(`Ответ Pachca ${path}: ${serialized}`);
  }

  private safeSerialize(value: unknown, maxLen: number): string {
    try {
      const json = JSON.stringify(value);
      if (json.length <= maxLen) {
        return json;
      }
      return `${json.slice(0, maxLen)}...`;
    } catch (error) {
      if (this.shouldLog('warn')) {
        this.logger.warn(
          'Не удалось сериализовать ответ Pachca.',
          error as Error,
        );
      }
      return '[unserializable]';
    }
  }

  private async delay(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private getRequired(key: string): string {
    const value = this.configService.get<string>(key);
    if (!value) {
      throw new Error(`Missing required env: ${key}`);
    }
    return value;
  }

  private getLogLevel(): PachcaLogLevel {
    const raw = this.configService.get<string>('PACHCA_LOG_LEVEL', 'warn');
    if (raw === 'debug' || raw === 'info' || raw === 'warn' || raw === 'error') {
      return raw;
    }
    return 'none';
  }

  private getInternalCookie(): string | null {
    const rawCookie = this.configService.get<string>('PACHCA_INTERNAL_COOKIE');
    if (rawCookie) {
      return rawCookie;
    }
    const jwt = this.configService.get<string>('PACHCA_INTERNAL_JWT');
    if (!jwt) {
      return null;
    }
    return `jwt=${jwt}`;
  }

  private shouldLog(level: PachcaLogLevel): boolean {
    return (
      PachcaApiClient.levelOrder[level] >=
      PachcaApiClient.levelOrder[this.logLevel]
    );
  }
}

type PachcaLogLevel = 'debug' | 'info' | 'warn' | 'error' | 'none';
