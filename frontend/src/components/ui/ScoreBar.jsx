import React from 'react';

export default function ScoreBar({ score, handCount }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1 bg-indigo-50 px-2.5 py-1 rounded-full">
        <span className="text-sm">🃏</span>
        <span className="text-sm font-bold text-indigo-700">{handCount}</span>
      </div>
      <div className="flex items-center gap-1 bg-amber-50 px-2.5 py-1 rounded-full">
        <span className="text-sm">⭐</span>
        <span className="text-sm font-bold text-amber-700">{score}</span>
      </div>
    </div>
  );
}
