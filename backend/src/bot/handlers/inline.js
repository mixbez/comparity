import { getAllDecks } from '../../db/models/deck.js';

export async function handleInlineQuery(ctx) {
  const decks = await getAllDecks();

  const results = decks.map((deck) => ({
    type: 'article',
    id: String(deck.id),
    title: `${deck.icon_emoji || '🃏'} ${deck.name}`,
    description: `${deck.description || ''} | ${deck.card_count} карт`,
    input_message_content: {
      message_text:
        `🎮 *Comparity* — ${deck.name}\n\n` +
        `📏 Параметр: *${deck.parameter_name}*\n` +
        `Нажми кнопку, чтобы присоединиться!`,
      parse_mode: 'Markdown',
    },
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: '🎯 Начать групповую игру',
            callback_data: `group_start:${deck.id}`,
          },
        ],
      ],
    },
  }));

  await ctx.answerInlineQuery(results, { cache_time: 10 });
}
