export interface User {
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
