import React, { useEffect } from 'react';
import { useGameStore } from '../store/gameStore.js';
import ChainArea from './chain/ChainArea.jsx';
import PlayerCard from './cards/PlayerCard.jsx';
import ScoreBar from './ui/ScoreBar.jsx';
import ResultBanner from './ui/ResultBanner.jsx';
import ChallengeButton from './ui/ChallengeButton.jsx';
import GameOverScreen from './ui/GameOverScreen.jsx';

export default function GameScreen() {
  const { session, status, lastResult, clearResult } = useGameStore();

  useEffect(() => {
    if (lastResult) {
      const t = setTimeout(clearResult, 2500);
      return () => clearTimeout(t);
    }
  }, [lastResult]);

  if (status === 'finished') return <GameOverScreen session={session} />;

  const tg = window.Telegram?.WebApp;
  const userId = String(tg?.initDataUnsafe?.user?.id);
  const myScore = session?.players?.[userId]?.score ?? 0;
  const pendingChallenge = session?.pendingChallenge;
  const isMyTurn = session?.currentTurn?.userId === userId;

  return (
    <div className="flex flex-col h-screen bg-tg-bg overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-4 pt-3 pb-2 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-tg-hint uppercase tracking-wide">
              {session?.deckName}
            </p>
            <p className="text-sm font-semibold text-tg-text">
              Параметр: {session?.deckParameterName}
            </p>
          </div>
          <ScoreBar score={myScore} />
        </div>
      </div>

      {/* Chain */}
      <div className="flex-1 overflow-hidden relative">
        <ChainArea chain={session?.chain ?? []} />
      </div>

      {/* Result banner */}
      {lastResult && <ResultBanner result={lastResult} />}

      {/* Challenge button (shown when there's a bluff to challenge) */}
      {pendingChallenge && !isMyTurn && (
        <ChallengeButton expiresAt={pendingChallenge.expiresAt} />
      )}

      {/* Player card in hand + confirm action */}
      <div className="flex-shrink-0">
        <PlayerCard />
      </div>
    </div>
  );
}
