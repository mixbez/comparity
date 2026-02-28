import React from 'react';

export default function LoadingScreen() {
  return (
    <div className="h-screen flex flex-col items-center justify-center bg-tg-bg">
      <div className="text-5xl mb-4 animate-bounce">🎴</div>
      <p className="text-tg-hint text-sm">Загрузка игры...</p>
    </div>
  );
}
