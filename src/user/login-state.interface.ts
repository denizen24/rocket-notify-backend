export interface LoginState {
  step: 'server' | 'user' | 'pass';
  server?: string;
  user?: string;
  createdAt: Date;
}
