import React, { useEffect, useState } from 'react';
import { authenticate, subscribeToSession } from './api/client.js';
import { useGameStore } from './store/gameStore.js';
import GameScreen from './components/GameScreen.jsx';
import LoadingScreen from './components/ui/LoadingScreen.jsx';
import ErrorScreen from './components/ui/ErrorScreen.jsx';

export default function App() {
  const [authState, setAuthState] = useState('loading'); // loading | ok | error
  const { sessionId, loadSession, updateSession, status } = useGameStore();

  // Auth on mount
  useEffect(() => {
    authenticate()
      .then(() => {
        setAuthState('ok');
        // Get sessionId from URL params (passed by bot)
        const params = new URLSearchParams(window.location.search);
        const sid = params.get('sessionId');
        if (sid) loadSession(sid);
      })
      .catch(() => setAuthState('error'));
  }, []);

  // Subscribe to real-time updates once session is loaded
  useEffect(() => {
    if (!sessionId || authState !== 'ok') return;
    const unsubscribe = subscribeToSession(sessionId, (event) => {
      if (event.type === 'CHAIN_UPDATED' || event.type === 'CHALLENGE_END') {
        updateSession(event.payload);
      }
    });
    return unsubscribe;
  }, [sessionId, authState]);

  if (authState === 'loading' || status === 'loading') return <LoadingScreen />;
  if (authState === 'error') return <ErrorScreen message="Не удалось подключиться" />;
  if (!sessionId) return <ErrorScreen message="Сессия не найдена. Запусти игру через бота!" />;

  return <GameScreen />;
}
