import { useCallback, useState, type FormEvent } from 'react';
import type { Credentials } from '../api/greenApi';
import { useChats } from '../useChats';
import ChatWindow from './ChatWindow';

interface Props {
  creds: Credentials;
  onLogout: () => void;
}

const time = (ts: number) =>
  new Date(ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

export default function Messenger({ creds, onLogout }: Props) {
  const [error, setError] = useState<string | null>(null);
  const onError = useCallback((m: string | null) => setError(m), []);
  const { chats, activeId, openChat, createChat, send } = useChats(creds, onError);

  const [phone, setPhone] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const list = Object.values(chats).sort((a, b) => b.updatedAt - a.updatedAt);
  const active = activeId ? chats[activeId] : null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      await createChat(phone);
      setPhone('');
    } catch (err) {
      setCreateError((err as Error).message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className={`app ${active ? 'chat-open' : ''}`}>
      <aside className="sidebar">
        <header className="sidebar-head">
          <div className="logo small">MAX</div>
          <div className="grow">
            <strong>Чаты</strong>
            <div className="muted small-text">Инстанс {creds.idInstance}</div>
          </div>
          <button className="link" onClick={onLogout}>
            Выйти
          </button>
        </header>

        <form className="new-chat" onSubmit={submit}>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Новый чат: 79991234567"
            inputMode="tel"
          />
          <button className="primary" disabled={creating || !phone.trim()} title="Создать чат">
            {creating ? '…' : '+'}
          </button>
        </form>
        {createError && <div className="error pad">{createError}</div>}

        <ul className="chat-list">
          {list.length === 0 && <li className="empty">Введите номер телефона, чтобы начать чат</li>}
          {list.map((c) => {
            const last = c.messages[c.messages.length - 1];
            return (
              <li key={c.chatId}>
                <button className={`chat-item ${c.chatId === activeId ? 'active' : ''}`} onClick={() => openChat(c.chatId)}>
                  <span className="avatar">{(c.name.replace('+', '')[0] ?? '?').toUpperCase()}</span>
                  <span className="grow">
                    <span className="row">
                      <strong className="ellipsis">{c.name}</strong>
                      {last && <span className="muted small-text">{time(last.timestamp)}</span>}
                    </span>
                    <span className="row">
                      <span className="muted ellipsis">{last ? last.text : 'Нет сообщений'}</span>
                      {c.unread > 0 && <span className="badge">{c.unread}</span>}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {error && <div className="error pad">{error}</div>}
      </aside>

      <main className="main">
        {active ? (
          <ChatWindow chat={active} onBack={() => openChat('')} onSend={(t) => send(active.chatId, t)} />
        ) : (
          <div className="placeholder">Выберите чат или создайте новый по номеру телефона</div>
        )}
      </main>
    </div>
  );
}
