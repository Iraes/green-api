import { useState, type FormEvent } from 'react';
import { DEFAULT_API_URL, getStateInstance, type Credentials } from '../api/greenApi';

interface Props {
  onLogin: (c: Credentials) => void;
}

export default function Login({ onLogin }: Props) {
  const [idInstance, setId] = useState('');
  const [apiTokenInstance, setToken] = useState('');
  const [apiUrl, setUrl] = useState(DEFAULT_API_URL);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const creds: Credentials = {
      idInstance: idInstance.trim(),
      apiTokenInstance: apiTokenInstance.trim(),
      apiUrl: apiUrl.trim() || DEFAULT_API_URL,
    };
    if (!/^\d+$/.test(creds.idInstance)) {
      setError('idInstance — это число, например 3100000000');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const state = await getStateInstance(creds);
      if (state !== 'authorized') {
        setError(`Инстанс не авторизован (состояние: ${state}). Авторизуйте MAX в личном кабинете GREEN-API.`);
        return;
      }
      onLogin(creds);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <div className="logo">MAX</div>
        <h1>Вход в чат</h1>
        <p className="muted">Введите данные инстанса из личного кабинета GREEN-API</p>

        <label>
          idInstance
          <input value={idInstance} onChange={(e) => setId(e.target.value)} inputMode="numeric" autoFocus required />
        </label>
        <label>
          apiTokenInstance
          <input type="password" value={apiTokenInstance} onChange={(e) => setToken(e.target.value)} required />
        </label>
        <label>
          apiUrl
          <input value={apiUrl} onChange={(e) => setUrl(e.target.value)} />
        </label>

        {error && <div className="error">{error}</div>}
        <button className="primary" disabled={busy}>
          {busy ? 'Проверка…' : 'Войти'}
        </button>
      </form>
    </div>
  );
}
