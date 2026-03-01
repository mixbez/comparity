import React from 'react';

export default function GameOverScreen({ session }) {
  const tg = window.Telegram?.WebApp;
  const myId = String(tg?.initDataUnsafe?.user?.id);
  const players = session?.players || {};
  const myScore = players[myId]?.score ?? 0;

  const allScores = Object.entries(players).sort(([, a], [, b]) => b.score - a.score);
  const maxScore = allScores[0]?.[1]?.score ?? 0;
  const isWinner = myScore === maxScore;

  const handleShare = () => {
    tg?.switchInlineQuery(`Я набрал ${myScore} очков в Comparity! Сыграй со мной!`);
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
        {session?.deckName} • {session?.chain?.length} карточек в цепочке
      </p>

      {/* Score display */}
      <div className="w-full max-w-xs bg-tg-secondary rounded-2xl p-5 mb-6">
        <div className="text-center mb-4">
          <p className="text-tg-hint text-xs uppercase tracking-wide mb-1">Твои очки</p>
          <p className="text-5xl font-bold text-indigo-600 animate-score-pop">{myScore}</p>
        </div>

        {allScores.length > 1 && (
          <div className="space-y-2">
            <p className="text-xs text-tg-hint text-center">Все игроки</p>
            {allScores.map(([uid, { score }], i) => (
              <div key={uid} className="flex items-center justify-between">
                <span className="text-sm text-tg-text">
                  {['🥇','🥈','🥉'][i] || `${i+1}.`} {uid === myId ? 'Ты' : `Игрок ${i+1}`}
                </span>
                <span className="font-semibold text-sm text-indigo-600">{score} очков</span>
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
          📢 Позвать друзей
        </button>
        <button
          type="button"
          onClick={handlePlayAgain}
          className="w-full py-3 rounded-2xl border border-gray-200 text-tg-text text-sm active:scale-95 transition-transform"
        >
          ← Вернуться в бот
        </button>
      </div>
    </div>
  );
}
