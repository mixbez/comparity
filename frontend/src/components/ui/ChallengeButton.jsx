import React from 'react';
import { useGameStore } from '../../store/gameStore.js';

export default function ChallengeButton() {
  const { challenge, status } = useGameStore();

  return (
    <div className="px-4 pb-2">
      <button
        type="button"
        onClick={challenge}
        disabled={status === 'loading'}
        className="
          w-full py-3 rounded-2xl font-bold text-white text-base
          bg-gradient-to-r from-red-500 to-orange-500
          shadow-lg active:scale-95 transition-transform
          flex items-center justify-center gap-2
        "
      >
        <span>🔍</span>
        <span>Не верю!</span>
      </button>
    </div>
  );
}
