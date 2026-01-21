import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class CryptoService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly salt: string;

  constructor(private readonly configService: ConfigService) {
    this.salt = this.configService.get<string>('RC_TOKEN_SALT') || '';
    if (!this.salt) {
      throw new Error('Missing required env: RC_TOKEN_SALT');
    }
  }

  /**
   * Шифрует токен Rocket.Chat с использованием AES-256-GCM
   */
  encrypt(text: string): string {
    const key = crypto.scryptSync(this.salt, 'salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // Формат: iv:authTag:encrypted
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  /**
   * Расшифровывает токен Rocket.Chat
   */
  decrypt(encryptedText: string): string {
    const [ivHex, authTagHex, encrypted] = encryptedText.split(':');
    if (!ivHex || !authTagHex || !encrypted) {
      throw new Error('Invalid encrypted format');
    }

    const key = crypto.scryptSync(this.salt, 'salt', 32);
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}
