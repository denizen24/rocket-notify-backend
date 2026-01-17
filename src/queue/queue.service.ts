import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { User } from '../database/user.schema';

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(@InjectQueue('polling') private pollingQueue: Queue) {}

  async addPollingJob(user: User) {
    await this.pollingQueue.add(
      'check-unread',
      {
        user: {
          _id: user._id.toString(),
          telegramId: user.telegramId,
          rcServer: user.rcServer,
          rcToken: user.rcToken,
          rcUserId: user.rcUserId,
          rcInstanceId: user.rcInstanceId,
          lastUnread: user.lastUnread,
        },
      },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
  }

  async schedulePollingForAllUsers(users: User[]) {
    this.logger.log(`[📋 Добавление ${users.length} задач в очередь]`);
    for (const user of users) {
      await this.addPollingJob(user);
    }
  }
}
