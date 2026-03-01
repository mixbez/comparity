import React from 'react';
import { useGameStore } from '../../store/gameStore.js';

export default function ChainSlot({ id, position }) {
  const { pendingPosition, setPendingPosition } = useGameStore();
  const isSelected = pendingPosition === position;

  return (
    <div
      onClick={() => setPendingPosition(position)}
      className={`
        h-28 rounded-lg border-2 border-dashed flex items-center justify-center
        transition-all duration-150 flex-shrink-0 cursor-pointer
        ${isSelected ? 'border-green-500 bg-green-100 w-12' : ''}
        ${!isSelected ? 'border-gray-400 bg-gray-50 w-10 opacity-70 hover:opacity-100 hover:border-blue-400 hover:bg-blue-50' : ''}
      `}
    >
      <span className="text-sm font-bold select-none">
        {isSelected ? '✓' : '+'}
      </span>
    </div>
  );
}
