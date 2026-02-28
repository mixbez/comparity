import React from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core';
import { useGameStore } from '../../store/gameStore.js';
import ChainSlot from './ChainSlot.jsx';
import ChainCard from '../cards/ChainCard.jsx';

export default function ChainArea({ chain }) {
  const { draggedCard, setDraggedCard, setPendingPosition } = useGameStore();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } })
  );

  function handleDragEnd(event) {
    const { over } = event;
    if (over) {
      const position = parseInt(over.id.replace('slot-', ''));
      setPendingPosition(position);
    }
    setDraggedCard(null);
  }

  // Slots = chain.length + 1 (before each card + after last)
  const slotCount = chain.length + 1;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="chain-scroll h-full flex items-center px-4">
        <div className="flex items-center gap-1 min-w-max py-4">
          {Array.from({ length: slotCount }).map((_, slotIdx) => (
            <React.Fragment key={slotIdx}>
              <ChainSlot id={`slot-${slotIdx}`} position={slotIdx} />
              {slotIdx < chain.length && (
                <ChainCard card={chain[slotIdx]} index={slotIdx} />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      <DragOverlay>
        {draggedCard && (
          <div className="opacity-80 rotate-3 scale-110">
            <ChainCard card={draggedCard} isDragging />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
