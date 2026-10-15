import { useCallback, useState } from 'react';
import type { Credentials } from './api/greenApi';
import Login from './components/Login';
import Messenger from './components/Messenger';

const CREDS_KEY = 'max-chat:credentials';

function loadCreds(): Credentials | null {
  try {
    const raw = localStorage.getItem(CREDS_KEY);
    return raw ? (JSON.parse(raw) as Credentials) : null;
  } catch {
    return null;
  }
}

export default function App() {
  const [creds, setCreds] = useState<Credentials | null>(loadCreds);

  const login = useCallback((c: Credentials) => {
    try {
      localStorage.setItem(CREDS_KEY, JSON.stringify(c));
    } catch {
      /* ignore */
    }
    setCreds(c);
  }, []);

  const logout = useCallback(() => {
    try {
      localStorage.removeItem(CREDS_KEY);
    } catch {
      /* ignore */
    }
    setCreds(null);
  }, []);

  return creds ? <Messenger creds={creds} onLogout={logout} /> : <Login onLogin={login} />;
}
