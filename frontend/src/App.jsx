import React, { useEffect, useState } from 'react';
import { authenticate, subscribeToSession } from './api/client.js';
import { useGameStore } from './store/gameStore.js';
import GameScreen from './components/GameScreen.jsx';
import LoadingScreen from './components/ui/LoadingScreen.jsx';
import ErrorScreen from './components/ui/ErrorScreen.jsx';

export default function App() {
  const [authState, setAuthState] = useState('loading'); // loading | ok | error
  const {
    sessionId, loadSession, updateSession, status,
    handleChainUpdated, handleChallengeResult, handlePlayerJoined,
  } = useGameStore();

  // Auth on mount
  useEffect(() => {
    authenticate()
      .then(() => {
        setAuthState('ok');
        // Get sessionId: from URL param (webApp button) or start_param (deep link in groups)
        const params = new URLSearchParams(window.location.search);
        const sid = params.get('sessionId')
          || window.Telegram?.WebApp?.initDataUnsafe?.start_param;
        if (sid) loadSession(sid);
      })
      .catch(() => setAuthState('error'));
  }, []);

  // Subscribe to real-time updates once session is loaded
  useEffect(() => {
    if (!sessionId || authState !== 'ok') return;
    const unsubscribe = subscribeToSession(sessionId, (event) => {
      switch (event.type) {
        case 'STATE':
          updateSession(event.payload);
          break;
        case 'CHAIN_UPDATED':
          handleChainUpdated(event.payload);
          break;
        case 'CHALLENGE_RESULT':
          handleChallengeResult(event.payload);
          break;
        case 'PLAYER_JOINED':
          handlePlayerJoined(event.payload);
          break;
      }
    });
    return unsubscribe;
  }, [sessionId, authState]);

  if (authState === 'loading' || status === 'loading') return <LoadingScreen />;
  if (authState === 'error') return <ErrorScreen message="Не удалось подключиться" />;
  if (!sessionId) return <ErrorScreen message="Сессия не найдена. Запусти игру через бота!" />;

  return <GameScreen />;
}
