export interface Credentials {
  idInstance: string;
  apiTokenInstance: string;
  apiUrl: string;
}

export const DEFAULT_API_URL = 'https://green-api.com';

export interface Notification {
  receiptId: number;
  body: NotificationBody;
}

export interface NotificationBody {
  typeWebhook: string;
  timestamp?: number;
  idMessage?: string;
  senderData?: {
    chatId: string;
    chatName?: string;
    chatType?: string;
    sender?: string;
    senderName?: string;
    senderPhoneNumber?: number;
  };
  messageData?: {
    typeMessage: string;
    textMessageData?: { textMessage: string };
    extendedTextMessageData?: { text: string };
  };
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function url(c: Credentials, method: string, tail = ''): string {
  const base = (c.apiUrl || DEFAULT_API_URL).replace(/\/+$/, '');
  return `${base}/waInstance${c.idInstance}/${method}/${c.apiTokenInstance}${tail}`;
}

async function request<T>(
  input: string,
  init?: RequestInit,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(input, init);
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new ApiError('Нет соединения с GREEN-API', 0);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const hint =
      res.status === 401 || res.status === 403
        ? 'Неверные учётные данные или доступ запрещён'
        : text || res.statusText;
    throw new ApiError(`Ошибка ${res.status}: ${hint}`, res.status);
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

const jsonPost = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

/** Проверка учётных данных: возвращает состояние инстанса. */
export async function getStateInstance(c: Credentials): Promise<string> {
  const r = await request<{ stateInstance: string }>(url(c, 'getStateInstance'));
  return r.stateInstance;
}

/** Получение chatId MAX по номеру телефона. */
export async function checkAccount(
  c: Credentials,
  phoneNumber: number,
): Promise<{ exist: boolean; chatId: string }> {
  const r = await request<{ exist?: boolean; chatId?: string; reason?: string }>(
    url(c, 'checkAccount'),
    jsonPost({ phoneNumber }),
  );
  if (r.reason) throw new ApiError(r.reason, 0);
  return { exist: !!r.exist, chatId: r.chatId ?? '' };
}

/** SendMessage: https://green-api.com/v3/docs/api/sending/SendMessage/ */
export async function sendMessage(
  c: Credentials,
  chatId: string,
  message: string,
): Promise<string> {
  const r = await request<{ idMessage: string }>(
    url(c, 'sendMessage'),
    jsonPost({ chatId, message }),
  );
  return r.idMessage;
}

/** ReceiveNotification (long polling). Возвращает null, если уведомлений нет. */
export async function receiveNotification(
  c: Credentials,
  signal: AbortSignal,
): Promise<Notification | null> {
  return request<Notification | null>(url(c, 'receiveNotification', '?receiveTimeout=5'), {
    signal,
  });
}

export async function deleteNotification(
  c: Credentials,
  receiptId: number,
  signal?: AbortSignal,
): Promise<void> {
  await request(url(c, 'deleteNotification', `/${receiptId}`), { method: 'DELETE', signal });
}
