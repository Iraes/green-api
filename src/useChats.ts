import { useCallback, useEffect, useRef, useState } from 'react';
import * as api from './api/greenApi';
import type { Credentials, NotificationBody } from './api/greenApi';
import type { Chat, Chats, Message } from './types';

const storageKey = (idInstance: string) => `max-chat:${idInstance}`;

function load(idInstance: string): Chats {
  try {
    return JSON.parse(localStorage.getItem(storageKey(idInstance)) ?? '{}') as Chats;
  } catch {
    return {};
  }
}

function textOf(body: NotificationBody): string | null {
  const m = body.messageData;
  if (!m) return null;
  if (m.typeMessage === 'textMessage') return m.textMessageData?.textMessage ?? null;
  if (m.typeMessage === 'extendedTextMessage') return m.extendedTextMessageData?.text ?? null;
  return null;
}

/** Добавляет сообщение в чат (с дедупликацией по id). */
function addMessage(chats: Chats, chat: Omit<Chat, 'messages' | 'unread' | 'updatedAt'>, msg: Message, markUnread: boolean): Chats {
  const existing = chats[chat.chatId];
  if (existing?.messages.some((m) => m.id === msg.id)) return chats;
  const base: Chat = existing ?? { ...chat, messages: [], unread: 0, updatedAt: 0 };
  return {
    ...chats,
    [chat.chatId]: {
      ...base,
      name: chat.name || base.name,
      phone: chat.phone ?? base.phone,
      messages: [...base.messages, msg],
      unread: markUnread ? base.unread + 1 : base.unread,
      updatedAt: msg.timestamp,
    },
  };
}

export function useChats(creds: Credentials, onError: (msg: string | null) => void) {
  const [chats, setChats] = useState<Chats>(() => load(creds.idInstance));
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeRef = useRef(activeId);
  activeRef.current = activeId;

  useEffect(() => {
    try {
      localStorage.setItem(storageKey(creds.idInstance), JSON.stringify(chats));
    } catch {
      /* localStorage недоступен — продолжаем без сохранения */
    }
  }, [chats, creds.idInstance]);

  // Получение сообщений: ReceiveNotification -> обработка -> DeleteNotification
  useEffect(() => {
    const ctrl = new AbortController();

    const handle = (body: NotificationBody) => {
      const type = body.typeWebhook;
      const sd = body.senderData;
      const text = textOf(body);
      if (!sd || !body.idMessage || text === null) return;
      const incoming = type === 'incomingMessageReceived';
      const outgoing = type === 'outgoingMessageReceived' || type === 'outgoingAPIMessageReceived';
      if (!incoming && !outgoing) return;

      const msg: Message = {
        id: body.idMessage,
        text,
        outgoing,
        timestamp: (body.timestamp ?? Date.now() / 1000) * 1000,
        status: outgoing ? 'sent' : undefined,
      };
      const info = {
        chatId: sd.chatId,
        name: sd.chatName || sd.senderName || sd.chatId,
        phone: incoming && sd.senderPhoneNumber ? String(sd.senderPhoneNumber) : undefined,
      };
      // В исходящих уведомлениях senderData описывает собеседника только для личных чатов
      setChats((prev) => addMessage(prev, info, msg, incoming && activeRef.current !== sd.chatId));
    };

    (async () => {
      let failures = 0;
      while (!ctrl.signal.aborted) {
        try {
          const n = await api.receiveNotification(creds, ctrl.signal);
          onError(null);
          failures = 0;
          if (!n) continue;
          handle(n.body);
          await api.deleteNotification(creds, n.receiptId, ctrl.signal);
        } catch (e) {
          if ((e as Error).name === 'AbortError') return;
          failures += 1;
          onError((e as Error).message);
          await new Promise((r) => setTimeout(r, Math.min(2000 * failures, 15000)));
        }
      }
    })();

    return () => ctrl.abort();
  }, [creds, onError]);

  const openChat = useCallback((chatId: string) => {
    setActiveId(chatId);
    setChats((prev) =>
      prev[chatId] && prev[chatId].unread ? { ...prev, [chatId]: { ...prev[chatId], unread: 0 } } : prev,
    );
  }, []);

  /** Создать новый чат по номеру телефона (CheckAccount -> chatId). */
  const createChat = useCallback(
    async (phoneRaw: string): Promise<void> => {
      const digits = phoneRaw.replace(/\D/g, '');
      if (digits.length < 11 || digits.length > 12) {
        throw new Error('Введите номер в международном формате, например 79991234567');
      }
      const { exist, chatId } = await api.checkAccount(creds, Number(digits));
      if (!exist || !chatId) throw new Error('Для этого номера не найден аккаунт MAX');
      setChats((prev) =>
        prev[chatId]
          ? prev
          : {
              ...prev,
              [chatId]: { chatId, name: `+${digits}`, phone: digits, messages: [], unread: 0, updatedAt: Date.now() },
            },
      );
      openChat(chatId);
    },
    [creds, openChat],
  );

  /** Отправка текстового сообщения методом SendMessage. */
  const send = useCallback(
    async (chatId: string, text: string) => {
      const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const timestamp = Date.now();
      const patch = (fn: (msgs: Message[]) => Message[]) =>
        setChats((prev) =>
          prev[chatId] ? { ...prev, [chatId]: { ...prev[chatId], messages: fn(prev[chatId].messages) } } : prev,
        );

      setChats((prev) => {
        const chat = prev[chatId];
        const msg: Message = { id: tempId, text, outgoing: true, timestamp, status: 'sending' };
        return { ...prev, [chatId]: { ...chat, messages: [...chat.messages, msg], updatedAt: timestamp } };
      });

      try {
        const idMessage = await api.sendMessage(creds, chatId, text);
        // Если уведомление об исходящем уже пришло, оставляем его, иначе подменяем временный id
        patch((msgs) =>
          msgs.some((m) => m.id === idMessage)
            ? msgs.filter((m) => m.id !== tempId)
            : msgs.map((m) => (m.id === tempId ? { ...m, id: idMessage, status: 'sent' } : m)),
        );
      } catch (e) {
        patch((msgs) => msgs.map((m) => (m.id === tempId ? { ...m, status: 'error' } : m)));
        onError((e as Error).message);
      }
    },
    [creds, onError],
  );

  return { chats, activeId, openChat, createChat, send };
}
