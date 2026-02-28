import { getAllDecks } from '../../db/models/deck.js';

export async function handleDecks(ctx) {
  const decks = await getAllDecks();

  if (!decks.length) {
    return ctx.reply('Колоды пока не добавлены.');
  }

  const text = decks
    .map(
      (d) =>
        `${d.icon_emoji || '🃏'} *${d.name}*\n` +
        `  ${d.description || ''}\n` +
        `  📏 Параметр: ${d.parameter_name}\n` +
        `  🃏 Карт: ${d.card_count}`
    )
    .join('\n\n');

  await ctx.reply(`🗂 *Доступные колоды:*\n\n${text}\n\nНачать игру: /play`, {
    parse_mode: 'Markdown',
  });
}
