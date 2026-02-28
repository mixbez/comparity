import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { useGameStore } from '../../store/gameStore.js';

export default function ChainSlot({ id, position }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const pendingPosition = useGameStore((s) => s.pendingPosition);
  const isSelected = pendingPosition === position;

  return (
    <div
      ref={setNodeRef}
      className={`
        h-28 w-8 rounded-lg border-2 border-dashed flex items-center justify-center
        transition-all duration-150 flex-shrink-0
        ${isOver ? 'border-blue-500 bg-blue-50 w-12 scale-110' : ''}
        ${isSelected ? 'border-green-500 bg-green-50' : 'border-gray-300'}
        ${!isOver && !isSelected ? 'opacity-40' : 'opacity-100'}
      `}
    >
      {(isOver || isSelected) && (
        <span className="text-xs text-center leading-tight px-1 font-medium text-blue-600">
          {isSelected ? '✓' : '↓'}
        </span>
      )}
    </div>
  );
}
