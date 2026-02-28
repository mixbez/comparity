import React from 'react';

export default function ScoreBar({ score }) {
  return (
    <div className="flex items-center gap-1.5 bg-indigo-50 px-3 py-1.5 rounded-full">
      <span className="text-base">⭐</span>
      <span className="text-sm font-bold text-indigo-700">{score}</span>
    </div>
  );
}
