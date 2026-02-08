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
} from './pachca.types';

@Injectable()
export class PachcaApiClient {
  private readonly logger = new Logger(PachcaApiClient.name);
  private readonly baseUrl: string;
  private readonly accessToken: string;
  private readonly maxRetries = 3;
  private readonly baseDelayMs = 300;

  constructor(
    private readonly http: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl = this.getRequired('PACHCA_BASE_URL').replace(/\/+$/, '');
    this.accessToken = this.getRequired('PACHCA_ACCESS_TOKEN');
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

    if (Array.isArray(response)) {
      return response;
    }
    return response?.data ?? response?.items ?? [];
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
        this.logger.warn(
          `Ошибка запроса к Pachca, попытка ${attempt} из ${this.maxRetries}.`,
        );
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
}
