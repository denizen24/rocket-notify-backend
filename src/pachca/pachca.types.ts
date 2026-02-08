export type PachcaId = string | number;

export interface PachcaChat {
  id: PachcaId;
  name?: string | null;
  type?: string | null;
}

export interface PachcaMessage {
  id: PachcaId;
  chat_id?: PachcaId;
  author_id?: PachcaId;
  text?: string | null;
  created_at?: string;
}

export interface PachcaReader {
  user_id: PachcaId;
  read_at?: string;
}

export interface PachcaListResponse<T> {
  data?: T[];
  items?: T[];
}
