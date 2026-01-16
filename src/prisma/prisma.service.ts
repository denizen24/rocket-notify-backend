import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(private readonly configService: ConfigService) {
    let databaseUrl =
      configService.get<string>('DATABASE_URL') || 'file:./dev.db';
    
    // Проверяем, что URL для SQLite (начинается с file:)
    // Если нет, используем дефолтный SQLite путь
    if (!databaseUrl.startsWith('file:')) {
      databaseUrl = 'file:./dev.db';
    }
    
    // Устанавливаем переменную окружения для Prisma
    process.env.DATABASE_URL = databaseUrl;
    
    // Для Prisma 7 с SQLite требуется адаптер
    const adapter = new PrismaBetterSqlite3({
      url: databaseUrl,
    });
    
    super({
      adapter,
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
