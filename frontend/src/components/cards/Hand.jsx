import React from 'react';
import { useGameStore } from '../../store/gameStore.js';

export default function Hand() {
  const { session, selectedCardId, selectCard, pendingPosition, confirmMove, status } = useGameStore();

  const tg = window.Telegram?.WebApp;
  const userId = String(tg?.initDataUnsafe?.user?.id);
  const hand = session?.players?.[userId]?.hand || [];

  if (!hand.length) {
    return (
      <div className="p-4 text-center text-tg-hint text-sm">
        У тебя нет карт!
      </div>
    );
  }

  return (
    <div className="bg-tg-secondary border-t border-gray-200 px-4 py-3">
      <p className="text-center text-xs text-tg-hint mb-2">
        {selectedCardId ? 'Тапни «+» в цепочке, чтобы поставить карту' : 'Выбери карту из руки'}
      </p>

      {/* Hand cards */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {hand.map((card) => (
          <button
            key={card.cardId}
            type="button"
            onClick={() => selectCard(card.cardId)}
            className={`
              flex-shrink-0 w-20 h-28 rounded-xl overflow-hidden transition-all
              ${selectedCardId === card.cardId
                ? 'ring-2 ring-indigo-500 scale-105 shadow-lg'
                : 'border border-gray-200 shadow-sm'}
            `}
          >
            <div className="h-full flex flex-col bg-white">
              {card.imageUrl ? (
                <img
                  src={card.imageUrl}
                  alt={card.title}
                  className="w-full h-14 object-cover"
                  loading="lazy"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'flex';
                  }}
                />
              ) : null}
              <div
                className="w-full h-14 bg-gradient-to-br from-blue-50 to-indigo-100 items-center justify-center text-2xl"
                style={{ display: card.imageUrl ? 'none' : 'flex' }}
              >
                🎴
              </div>
              <div className="flex-1 px-1.5 py-1">
                <p className="text-[10px] font-medium text-gray-800 leading-tight line-clamp-2">
                  {card.title}
                </p>
                <p className="text-[9px] text-indigo-400 mt-auto">???</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Confirm button */}
      {selectedCardId && (
        <button
          type="button"
          onClick={confirmMove}
          disabled={pendingPosition === null || status === 'loading'}
          className={`
            w-full mt-2 py-2.5 rounded-xl text-sm font-semibold transition-all
            ${pendingPosition !== null
              ? 'bg-indigo-600 text-white shadow-md active:scale-95'
              : 'bg-gray-100 text-gray-300 cursor-not-allowed'}
          `}
        >
          {pendingPosition !== null ? '✓ Поставить карту' : 'Выбери позицию в цепочке'}
        </button>
      )}
    </div>
  );
}
