import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import type { Chat } from '../types';

interface Props {
  chat: Chat;
  onSend: (text: string) => void;
  onBack: () => void;
}

const time = (ts: number) =>
  new Date(ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

export default function ChatWindow({ chat, onSend, onBack }: Props) {
  const [text, setText] = useState('');
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' });
  }, [chat.chatId, chat.messages.length]);

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setText('');
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) submit(e);
  };

  return (
    <section className="chat">
      <header className="chat-head">
        <button className="link back" onClick={onBack} aria-label="Назад">
          ←
        </button>
        <span className="avatar">{(chat.name.replace('+', '')[0] ?? '?').toUpperCase()}</span>
        <div>
          <strong>{chat.name}</strong>
          {chat.phone && <div className="muted small-text">+{chat.phone}</div>}
        </div>
      </header>

      <div className="messages">
        {chat.messages.length === 0 && <div className="empty">Сообщений пока нет. Напишите первым!</div>}
        {chat.messages.map((m) => (
          <div key={m.id} className={`bubble ${m.outgoing ? 'out' : 'in'} ${m.status === 'error' ? 'failed' : ''}`}>
            <span className="text">{m.text}</span>
            <span className="meta">
              {time(m.timestamp)}
              {m.outgoing && (m.status === 'sending' ? ' ⏳' : m.status === 'error' ? ' ⚠ не отправлено' : ' ✓')}
            </span>
          </div>
        ))}
        <div ref={bottom} />
      </div>

      <form className="composer" onSubmit={submit}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
          placeholder="Сообщение"
          rows={1}
          maxLength={4000}
        />
        <button className="primary send" disabled={!text.trim()} aria-label="Отправить">
          ➤
        </button>
      </form>
    </section>
  );
}
