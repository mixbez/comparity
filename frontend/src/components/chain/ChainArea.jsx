import React from 'react';
import { useGameStore } from '../../store/gameStore.js';
import ChainSlot from './ChainSlot.jsx';
import ChainCard from '../cards/ChainCard.jsx';

export default function ChainArea({ chain }) {
  const { selectedCardId } = useGameStore();

  // Slots = chain.length + 1 (before each card + after last)
  const slotCount = chain.length + 1;
  const showSlots = selectedCardId !== null;

  return (
    <div className="chain-scroll h-full flex items-center px-4">
      <div className="flex items-center gap-1 min-w-max py-4">
        {Array.from({ length: slotCount }).map((_, slotIdx) => (
          <React.Fragment key={slotIdx}>
            {showSlots && <ChainSlot id={`slot-${slotIdx}`} position={slotIdx} />}
            {slotIdx < chain.length && (
              <ChainCard card={chain[slotIdx]} />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
