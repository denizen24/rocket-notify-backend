export interface LoginState {
  step: 'server' | 'userId' | 'token';
  server?: string;
  userId?: string;
  createdAt: Date;
}
