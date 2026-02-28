import { Markup } from 'telegraf';
import { getAllDecks } from '../../db/models/deck.js';

export async function handleStart(ctx) {
  const firstName = ctx.from.first_name;
  const decks = await getAllDecks();

  const buttons = decks.map((d) => [
    Markup.button.callback(`${d.icon_emoji || '🃏'} ${d.name}`, `deck:${d.id}`),
  ]);

  await ctx.reply(
    `👋 Привет, *${firstName}*!\n\n` +
    `🎴 *Comparity* — расставь карточки в правильном порядке!\n\n` +
    `Выбери колоду, чтобы начать:\n`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard(buttons),
    }
  );
}
