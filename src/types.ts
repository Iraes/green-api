export interface Message {
  id: string;
  text: string;
  outgoing: boolean;
  timestamp: number; // ms
  status?: 'sending' | 'sent' | 'error';
}

export interface Chat {
  chatId: string;
  name: string;
  phone?: string;
  messages: Message[];
  unread: number;
  updatedAt: number;
}

export type Chats = Record<string, Chat>;
