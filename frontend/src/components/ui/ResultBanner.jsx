import React from 'react';

const RESULT_CONFIG = {
  correct: {
    icon: '✅',
    text: 'Правильно!',
    sub: '+1 очко',
    bg: 'bg-green-500',
  },
  incorrect: {
    icon: '❌',
    text: 'Неверно!',
    sub: 'Карточка не подходит',
    bg: 'bg-red-500',
  },
  bluff_placed: {
    icon: '🎭',
    text: 'Блеф сыгран!',
    sub: 'Ждём оспаривания...',
    bg: 'bg-purple-600',
  },
  bluff_caught: {
    icon: '🎯',
    text: 'Блеф раскрыт!',
    sub: '+2 очка за раскрытие',
    bg: 'bg-orange-500',
  },
  bluff_held: {
    icon: '🛡',
    text: 'Блеф устоял!',
    sub: '+2 очка защитнику',
    bg: 'bg-indigo-600',
  },
  error: {
    icon: '⚠️',
    text: 'Ошибка',
    sub: 'Попробуй ещё раз',
    bg: 'bg-gray-600',
  },
};

export default function ResultBanner({ result }) {
  const config = RESULT_CONFIG[result.type] || RESULT_CONFIG.error;

  return (
    <div
      className={`
        fixed top-16 left-1/2 -translate-x-1/2
        ${config.bg} text-white
        px-5 py-3 rounded-2xl shadow-xl
        flex items-center gap-3
        animate-slide-in z-50
      `}
    >
      <span className="text-2xl">{config.icon}</span>
      <div>
        <p className="font-bold text-sm">{config.text}</p>
        <p className="text-xs opacity-80">{config.sub}</p>
      </div>
    </div>
  );
}
