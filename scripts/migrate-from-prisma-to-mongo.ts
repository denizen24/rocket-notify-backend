/**
 * Скрипт миграции данных из Prisma/SQLite в MongoDB
 * 
 * Использование:
 * npm run migrate:prisma-to-mongo
 * 
 * Требования:
 * - SQLite база данных (dev.db) должна существовать
 * - MongoDB должна быть запущена и доступна
 * - Переменные окружения DATABASE_URL (MongoDB) и RC_TOKEN_SALT должны быть установлены
 */

import { PrismaClient } from '@prisma/client';
import { MongoClient } from 'mongodb';
import * as crypto from 'crypto';
import * as dotenv from 'dotenv';

dotenv.config();

interface PrismaUser {
  id: string;
  telegramId: string;
  rcServer: string | null;
  rcUser: string | null;
  rcToken: string | null;
  rcUserId: string | null;
  rcInstanceId: string | null;
  intervalMin: number;
  enabled: boolean;
  lastUnread: number;
  createdAt: Date;
  updatedAt: Date;
}

async function encryptToken(text: string, salt: string): Promise<string> {
  const algorithm = 'aes-256-gcm';
  const key = crypto.scryptSync(salt, 'salt', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

async function migrate() {
  const salt = process.env.RC_TOKEN_SALT;
  if (!salt) {
    throw new Error('Missing required env: RC_TOKEN_SALT');
  }

  const mongoUrl =
    process.env.DATABASE_URL ||
    'mongodb://admin:password@localhost:27017/rocket-notify?authSource=admin';

  console.log('📦 Подключение к SQLite...');
  const prisma = new PrismaClient();

  console.log('📦 Подключение к MongoDB...');
  const mongoClient = new MongoClient(mongoUrl);
  await mongoClient.connect();
  const db = mongoClient.db();

  try {
    console.log('📥 Чтение пользователей из SQLite...');
    const prismaUsers = await prisma.user.findMany();

    console.log(`📊 Найдено ${prismaUsers.length} пользователей`);

    if (prismaUsers.length === 0) {
      console.log('✅ Нет данных для миграции');
      return;
    }

    const usersCollection = db.collection('users');
    
    // Очищаем существующую коллекцию (опционально)
    console.log('🗑️  Очистка существующей коллекции users...');
    await usersCollection.deleteMany({});

    console.log('📤 Миграция пользователей в MongoDB...');
    let migrated = 0;
    let skipped = 0;

    for (const user of prismaUsers) {
      try {
        // Шифруем токен, если он есть
        let encryptedToken = user.rcToken;
        if (user.rcToken && !user.rcToken.includes(':')) {
          // Токен не зашифрован, шифруем его
          encryptedToken = await encryptToken(user.rcToken, salt);
        }

        const mongoUser = {
          telegramId: user.telegramId,
          rcServer: user.rcServer,
          rcUser: user.rcUser,
          rcToken: encryptedToken,
          rcUserId: user.rcUserId,
          rcInstanceId: user.rcInstanceId,
          intervalMin: user.intervalMin,
          enabled: user.enabled,
          lastUnread: user.lastUnread,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        };

        await usersCollection.insertOne(mongoUser);
        migrated++;
        console.log(`✅ Мигрирован пользователь: ${user.telegramId}`);
      } catch (error) {
        console.error(
          `❌ Ошибка миграции пользователя ${user.telegramId}:`,
          error,
        );
        skipped++;
      }
    }

    console.log('\n📊 Результаты миграции:');
    console.log(`✅ Успешно мигрировано: ${migrated}`);
    console.log(`⚠️  Пропущено: ${skipped}`);
    console.log(`📦 Всего: ${prismaUsers.length}`);

    // Создаём индекс для telegramId
    console.log('🔍 Создание индекса для telegramId...');
    await usersCollection.createIndex({ telegramId: 1 }, { unique: true });
    console.log('✅ Индекс создан');
  } catch (error) {
    console.error('❌ Ошибка миграции:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
    await mongoClient.close();
    console.log('🔌 Соединения закрыты');
  }
}

migrate()
  .then(() => {
    console.log('✅ Миграция завершена успешно');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Миграция завершилась с ошибкой:', error);
    process.exit(1);
  });
