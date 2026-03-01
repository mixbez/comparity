import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useGameStore } from '../../store/gameStore.js';

export default function PlayerCard() {
  const {
    session,
    pendingPosition,
    isBluffMode,
    toggleBluffMode,
    confirmMove,
    setDraggedCard,
    status,
  } = useGameStore();

  const card = session?.currentTurn?.card;
  const tgUserId = String(window.Telegram?.WebApp?.initDataUnsafe?.user?.id);
  const isMyTurn = session?.currentTurn?.userId === tgUserId;

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: 'player-card',
    disabled: !isMyTurn || !card,
    data: { card },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
  };

  // Track drag start
  const handlePointerDown = () => {
    if (card) setDraggedCard(card);
  };

  if (!card) {
    return (
      <div className="p-4 text-center text-tg-hint text-sm">
        {status === 'loading' ? 'Загрузка...' : 'Ожидание следующей карты...'}
      </div>
    );
  }

  if (!isMyTurn) {
    return (
      <div className="p-4 text-center text-tg-hint text-sm">
        Не твой ход...
      </div>
    );
  }

  return (
    <div className="bg-tg-secondary border-t border-gray-200">
      {/* Instructions */}
      <p className="text-center text-xs text-tg-hint pt-3 pb-1">
        Тапни на «+» в цепочке или перетащи карту
      </p>

      <div className="flex items-center gap-3 px-4 pb-4">
        {/* Draggable card */}
        <div
          ref={setNodeRef}
          style={style}
          {...listeners}
          {...attributes}
          onPointerDown={handlePointerDown}
          className={`
            relative flex-shrink-0 w-28 h-36 rounded-xl shadow-lg overflow-hidden
            cursor-grab active:cursor-grabbing select-none
            ${isDragging ? 'opacity-30' : ''}
            ${isBluffMode
              ? 'bg-gradient-to-br from-purple-600 to-indigo-700'
              : 'bg-white border-2 border-indigo-300'}
          `}
        >
          {isBluffMode ? (
            <div className="h-full flex flex-col items-center justify-center text-white">
              <div className="text-4xl mb-2">🎭</div>
              <p className="text-xs text-center px-2 opacity-90">{card.title}</p>
              <p className="text-xs opacity-60 mt-1">Режим блефа</p>
            </div>
          ) : (
            <div className="h-full flex flex-col">
              {card.imageUrl ? (
                <img
                  src={card.imageUrl}
                  alt={card.title}
                  className="w-full h-20 object-cover"
                />
              ) : (
                <div className="w-full h-20 bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center text-3xl">
                  🎴
                </div>
              )}
              <div className="flex-1 px-2 py-1.5 flex flex-col">
                <p className="text-xs font-semibold text-gray-800 leading-tight line-clamp-2">
                  {card.title}
                </p>
                {card.subtitle && (
                  <p className="text-[10px] text-gray-400 mt-0.5">{card.subtitle}</p>
                )}
                <p className="text-xs text-gray-400 mt-auto italic">Куда поставить?</p>
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex-1 flex flex-col gap-2">
          {/* Bluff toggle — only in multiplayer */}
          {session?.type !== 'SOLO' && (
            <button
              onClick={toggleBluffMode}
              className={`
                w-full py-2.5 px-3 rounded-xl text-sm font-medium transition-all
                ${isBluffMode
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'bg-white border border-gray-200 text-gray-600'}
              `}
            >
              {isBluffMode ? '🎭 Блеф вкл.' : '🎭 Блефовать'}
            </button>
          )}

          {/* Confirm placement */}
          <button
            onClick={confirmMove}
            disabled={pendingPosition === null || status === 'loading'}
            className={`
              w-full py-2.5 px-3 rounded-xl text-sm font-semibold transition-all
              ${pendingPosition !== null
                ? 'bg-indigo-600 text-white shadow-md active:scale-95'
                : 'bg-gray-100 text-gray-300 cursor-not-allowed'}
            `}
          >
            {pendingPosition !== null
              ? `✓ Поставить ${isBluffMode ? '(блеф)' : ''}`
              : 'Выбери позицию'}
          </button>
        </div>
      </div>
    </div>
  );
}
