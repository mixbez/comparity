import React, { useState, useEffect } from 'react';
import { useGameStore } from '../../store/gameStore.js';

export default function ChallengeButton({ expiresAt }) {
  const { challenge, status } = useGameStore();
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    const update = () => {
      const remaining = Math.max(0, expiresAt - Date.now());
      setTimeLeft(Math.ceil(remaining / 1000));
    };
    update();
    const interval = setInterval(update, 250);
    return () => clearInterval(interval);
  }, [expiresAt]);

  if (timeLeft <= 0) return null;

  const percent = Math.min(100, (timeLeft / 30) * 100);

  return (
    <div className="fixed bottom-48 left-0 right-0 flex justify-center px-6 z-40">
      <div className="w-full max-w-xs">
        {/* Timer bar */}
        <div className="h-1 bg-gray-200 rounded-full mb-2 overflow-hidden">
          <div
            className="h-full bg-red-500 transition-all duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>
        <button
          onClick={challenge}
          disabled={status === 'loading'}
          className="
            w-full py-3 rounded-2xl font-bold text-white text-base
            bg-gradient-to-r from-red-500 to-orange-500
            shadow-lg active:scale-95 transition-transform
            flex items-center justify-center gap-2
          "
        >
          <span>⚔️</span>
          <span>Оспорить! ({timeLeft}с)</span>
        </button>
      </div>
    </div>
  );
}
