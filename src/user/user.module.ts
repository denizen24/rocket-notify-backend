import { Module, forwardRef } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { PrismaModule } from '../prisma/prisma.module';
import { RocketChatModule } from '../rocket-chat/rocket-chat.module';

@Module({
  imports: [PrismaModule, forwardRef(() => RocketChatModule)],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
