import React from 'react';

export default function ErrorScreen({ message }) {
  return (
    <div className="h-screen flex flex-col items-center justify-center bg-tg-bg px-8 text-center">
      <div className="text-5xl mb-4">⚠️</div>
      <p className="text-tg-text font-semibold mb-2">Что-то пошло не так</p>
      <p className="text-tg-hint text-sm">{message}</p>
    </div>
  );
}
