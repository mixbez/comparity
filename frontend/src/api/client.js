const BASE_URL = import.meta.env.VITE_API_URL || '/api';

let authToken = null;

/**
 * Authenticate with backend using Telegram initData.
 * Must be called once on app startup.
 */
export async function authenticate() {
  const initData = window.Telegram?.WebApp?.initData;
  if (!initData) throw new Error('Not in Telegram Mini App');

  const res = await fetch(`${BASE_URL}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initData }),
  });

  if (!res.ok) throw new Error('Auth failed');
  const data = await res.json();
  authToken = data.token;
  return data.user;
}

function headers() {
  return {
    'Content-Type': 'application/json',
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
  };
}

async function request(method, path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: headers(),
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }

  return res.json();
}

export const api = {
  getSession: (id) => request('GET', `/sessions/${id}`),
  createSession: (deckId) => request('POST', '/sessions', { deckId }),
  makeMove: (sessionId, cardId, position, isBluff) =>
    request('POST', `/sessions/${sessionId}/move`, { cardId, position, isBluff }),
  challenge: (sessionId) => request('POST', `/sessions/${sessionId}/challenge`),
  getDecks: () => request('GET', '/decks'),
  getLeaderboard: (deckId) => request('GET', `/leaderboard${deckId ? `?deckId=${deckId}` : ''}`),
};

/**
 * Subscribe to SSE game updates.
 * @param {string} sessionId
 * @param {(event: {type: string, payload: any}) => void} onEvent
 * @returns {() => void} unsubscribe function
 */
export function subscribeToSession(sessionId, onEvent) {
  const url = `${BASE_URL}/sessions/${sessionId}/stream`;
  const source = new EventSource(url + `?token=${authToken}`);

  source.onmessage = (e) => {
    try {
      onEvent(JSON.parse(e.data));
    } catch {}
  };

  source.onerror = () => {
    console.warn('[SSE] Connection error, will retry');
  };

  return () => source.close();
}
