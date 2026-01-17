import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UserService } from './user.service';
import { User, UserModel } from '../database/user.schema';
import { RocketChatModule } from '../rocket-chat/rocket-chat.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserModel.schema }]),
    forwardRef(() => RocketChatModule),
    CommonModule,
  ],
  // UserController перемещён в BotModule для работы с Telegraf
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
