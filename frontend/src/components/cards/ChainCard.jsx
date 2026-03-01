import React from 'react';

export default function ChainCard({ card, isDragging = false }) {
  const isFaceDown = card.isFaceDown;

  return (
    <div
      className={`
        relative flex-shrink-0 w-24 h-28 rounded-xl shadow-md overflow-hidden
        select-none cursor-default
        ${isDragging ? 'shadow-2xl' : ''}
        ${isFaceDown ? 'bg-gradient-to-br from-indigo-600 to-purple-700' : 'bg-white border border-gray-200'}
      `}
    >
      {isFaceDown ? (
        // Face-down card (bluff)
        <div className="h-full flex flex-col items-center justify-center text-white">
          <div className="text-3xl mb-1">🃏</div>
          <p className="text-xs opacity-70 text-center px-1">Блеф?</p>
        </div>
      ) : (
        // Face-up card
        <div className="h-full flex flex-col">
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
            className="w-full h-14 bg-gradient-to-br from-blue-100 to-indigo-100 items-center justify-center text-2xl"
            style={{ display: card.imageUrl ? 'none' : 'flex' }}
          >
            🎴
          </div>
          <div className="flex-1 px-1.5 py-1 flex flex-col justify-between">
            <p className="text-[10px] font-medium text-gray-800 leading-tight line-clamp-2">
              {card.title}
            </p>
            <p className="text-xs font-bold text-indigo-600 mt-auto">
              {card.displayValue}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
