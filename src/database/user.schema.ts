import {
  prop,
  index,
  modelOptions,
  getModelForClass,
} from '@typegoose/typegoose';
import { TimeStamps } from '@typegoose/typegoose/lib/defaultClasses';

@index({ telegramId: 1 }, { unique: true })
@modelOptions({ schemaOptions: { collection: 'users', timestamps: true } })
export class User extends TimeStamps {
  @prop({ required: true, unique: true })
  telegramId!: string;

  @prop({ required: false })
  rcServer?: string; // https://rocketchat.medcontrol.cloud

  @prop({ required: false })
  rcUser?: string;

  @prop({ required: false })
  rcToken?: string; // зашифрованный токен

  @prop({ required: false })
  rcUserId?: string;

  @prop({ required: false })
  rcInstanceId?: string;

  @prop({ required: true, default: 5 })
  intervalMin!: number;

  @prop({ required: true, default: true })
  enabled!: boolean;

  @prop({ required: true, default: 0 })
  lastUnread!: number;
}

export const UserModel = getModelForClass(User);
