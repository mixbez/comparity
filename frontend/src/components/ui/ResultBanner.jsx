import React from 'react';

const RESULT_CONFIG = {
  card_placed: {
    icon: '🃏',
    text: 'Карта поставлена!',
    sub: 'Ждём следующий ход...',
    bg: 'bg-indigo-600',
  },
  chain_valid: {
    icon: '✅',
    text: 'Цепочка верна!',
    sub: 'Оспоривший получает штраф',
    bg: 'bg-green-500',
  },
  chain_invalid: {
    icon: '❌',
    text: 'Порядок нарушен!',
    sub: 'Нарушитель получает штрафные карты',
    bg: 'bg-red-500',
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
        <p className="text-xs opacity-80">{result.message || config.sub}</p>
      </div>
    </div>
  );
}
