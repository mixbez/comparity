import React from 'react';

export default function GameOverScreen({ session }) {
  const tg = window.Telegram?.WebApp;
  const myId = String(tg?.initDataUnsafe?.user?.id);
  const players = session?.players || {};
  const myHandCount = players[myId]?.handCount ?? players[myId]?.hand?.length ?? 0;
  const myScore = players[myId]?.score ?? 0;

  // Sort by hand count ascending (fewer cards = better)
  const allPlayers = Object.entries(players).sort(
    ([, a], [, b]) => (a.handCount ?? 0) - (b.handCount ?? 0)
  );
  const minCards = allPlayers[0]?.[1]?.handCount ?? 0;
  const isWinner = myHandCount === minCards;

  const handleShare = () => {
    tg?.switchInlineQuery(`Я выиграл в Comparity! Сыграй со мной!`);
  };

  const handlePlayAgain = () => {
    tg?.close();
  };

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-tg-bg px-6">
      <div className="text-6xl mb-4">{isWinner ? '🏆' : '🎮'}</div>
      <h1 className="text-2xl font-bold text-tg-text mb-1">
        {isWinner ? 'Победа!' : 'Игра окончена!'}
      </h1>
      <p className="text-tg-hint text-sm mb-8">
        {session?.deckName}
      </p>

      {/* Score display */}
      <div className="w-full max-w-xs bg-tg-secondary rounded-2xl p-5 mb-6">
        <div className="text-center mb-4">
          <p className="text-tg-hint text-xs uppercase tracking-wide mb-1">Карт в руке</p>
          <p className="text-5xl font-bold text-indigo-600 animate-score-pop">{myHandCount}</p>
          <p className="text-tg-hint text-xs mt-1">Очки: {myScore}</p>
        </div>

        {allPlayers.length > 1 && (
          <div className="space-y-2">
            <p className="text-xs text-tg-hint text-center">Все игроки</p>
            {allPlayers.map(([uid, p], i) => (
              <div key={uid} className="flex items-center justify-between">
                <span className="text-sm text-tg-text">
                  {['🥇','🥈','🥉'][i] || `${i+1}.`} {uid === myId ? 'Ты' : `Игрок ${i+1}`}
                </span>
                <span className="font-semibold text-sm text-indigo-600">
                  {p.handCount ?? 0} карт
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="w-full max-w-xs space-y-3">
        <button
          type="button"
          onClick={handleShare}
          className="w-full py-3 rounded-2xl bg-indigo-600 text-white font-semibold text-sm active:scale-95 transition-transform"
        >
          Позвать друзей
        </button>
        <button
          type="button"
          onClick={handlePlayAgain}
          className="w-full py-3 rounded-2xl border border-gray-200 text-tg-text text-sm active:scale-95 transition-transform"
        >
          Вернуться в бот
        </button>
      </div>
    </div>
  );
}
