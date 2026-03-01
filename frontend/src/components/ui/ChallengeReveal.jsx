import React from 'react';
import ChainCard from '../cards/ChainCard.jsx';

export default function ChallengeReveal({ result }) {
  const { chainValid, revealedChain, invalidPositions, penaltyPlayer } = result;

  return (
    <div className="h-full flex flex-col items-center justify-center px-4">
      <div className="text-5xl mb-3">{chainValid ? '✅' : '❌'}</div>
      <h2 className="text-lg font-bold text-tg-text mb-1">
        {chainValid ? 'Цепочка верна!' : 'Порядок нарушен!'}
      </h2>
      <p className="text-sm text-tg-hint mb-4">
        {chainValid
          ? 'Оспоривший получает штрафные карты'
          : 'Нарушитель получает штрафные карты'}
      </p>

      {/* Revealed chain */}
      <div className="flex gap-1 overflow-x-auto pb-4 max-w-full">
        {revealedChain.map((card, i) => (
          <div
            key={i}
            className={
              invalidPositions.includes(i)
                ? 'ring-2 ring-red-500 rounded-xl'
                : ''
            }
          >
            <ChainCard card={card} />
          </div>
        ))}
      </div>
    </div>
  );
}
