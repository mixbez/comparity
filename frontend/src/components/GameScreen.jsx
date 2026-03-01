import React, { useEffect } from 'react';
import { useGameStore } from '../store/gameStore.js';
import ChainArea from './chain/ChainArea.jsx';
import Hand from './cards/Hand.jsx';
import ScoreBar from './ui/ScoreBar.jsx';
import ResultBanner from './ui/ResultBanner.jsx';
import ChallengeButton from './ui/ChallengeButton.jsx';
import ChallengeReveal from './ui/ChallengeReveal.jsx';
import GameOverScreen from './ui/GameOverScreen.jsx';

export default function GameScreen() {
  const { session, status, lastResult, challengeResult, clearResult } = useGameStore();

  useEffect(() => {
    if (lastResult) {
      const t = setTimeout(clearResult, 2500);
      return () => clearTimeout(t);
    }
  }, [lastResult]);

  if (status === 'finished') return <GameOverScreen session={session} />;

  const tg = window.Telegram?.WebApp;
  const userId = String(tg?.initDataUnsafe?.user?.id);
  const myPlayer = session?.players?.[userId];
  const myScore = myPlayer?.score ?? 0;
  const myHandCount = myPlayer?.handCount ?? myPlayer?.hand?.length ?? 0;

  const currentPlayerId = session?.turnOrder?.[session?.currentPlayerIndex];
  const isMyTurn = currentPlayerId === userId;
  const canChallenge = isMyTurn
    && session?.lastMoveBy
    && session?.lastMoveBy !== userId
    && session?.chain?.length > 1;

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
              {session?.deckParameterName}
            </p>
          </div>
          <ScoreBar score={myScore} handCount={myHandCount} />
        </div>

        {/* Player indicators */}
        {session?.turnOrder?.length > 1 && (
          <div className="flex gap-2 mt-2">
            {session.turnOrder.map((pid, i) => (
              <div
                key={pid}
                className={`text-xs px-2 py-0.5 rounded-full ${
                  pid === currentPlayerId
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                {pid === userId ? 'Ты' : `P${i + 1}`}
                {' '}({session.players?.[pid]?.handCount ?? '?'})
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Chain or Challenge Reveal */}
      <div className="flex-1 overflow-hidden relative">
        {challengeResult ? (
          <ChallengeReveal result={challengeResult} />
        ) : (
          <ChainArea chain={session?.chain ?? []} />
        )}
      </div>

      {/* Result banner */}
      {lastResult && <ResultBanner result={lastResult} />}

      {/* Bottom area */}
      <div className="flex-shrink-0">
        {canChallenge && <ChallengeButton />}
        {isMyTurn ? (
          <Hand />
        ) : (
          !challengeResult && (
            <div className="p-4 text-center text-tg-hint text-sm">
              {session?.turnOrder?.length <= 1
                ? 'Ждём других игроков...'
                : 'Ход другого игрока...'}
            </div>
          )
        )}
      </div>
    </div>
  );
}
