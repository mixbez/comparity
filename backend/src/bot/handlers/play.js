import { Markup } from 'telegraf';
import { getAllDecks } from '../../db/models/deck.js';
import { createSession } from '../../game/session.js';

export async function handlePlay(ctx) {
  const args = ctx.message?.text?.split(' ');
  const deckIdArg = args?.[1] ? parseInt(args[1]) : null;

  if (deckIdArg) {
    return startGame(ctx, deckIdArg);
  }

  const decks = await getAllDecks();
  const buttons = decks.map((d) => [
    Markup.button.callback(`${d.icon_emoji || '🃏'} ${d.name} (${d.card_count} карт)`, `play:${d.id}`),
  ]);

  await ctx.reply('🎴 Выбери колоду для игры:', {
    ...Markup.inlineKeyboard(buttons),
  });
}

export async function startGame(ctx, deckId) {
  const userId = ctx.from.id;
  const loadingMsg = await ctx.reply('⏳ Создаём игру...');

  try {
    const { sessionId, session } = await createSession({
      userId,
      deckId,
      type: 'SOLO',
    });

    const startingCard = session.chain[0];
    const nextCard = session.currentTurn?.card;

    const miniAppUrl = `${process.env.MINI_APP_URL}?sessionId=${sessionId}`;

    await ctx.telegram.editMessageText(
      ctx.chat.id,
      loadingMsg.message_id,
      null,
      `🎮 *Игра началась!*\n\n` +
      `📦 Колода: *${session.deckName}*\n` +
      `📏 Параметр: *${session.deckParameterName}*\n\n` +
      `🃏 Стартовая карточка:\n` +
      `*${startingCard.title}* — ${startingCard.displayValue}\n\n` +
      `Твоя карточка: *${nextCard?.title || '?'}*\n` +
      `Куда её поставить в цепочке?`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.webApp('🎯 Открыть игру', miniAppUrl)],
        ]),
      }
    );
  } catch (err) {
    console.error('[Play] Error:', err.message);
    await ctx.telegram.editMessageText(
      ctx.chat.id,
      loadingMsg.message_id,
      null,
      '❌ Не удалось создать игру. Попробуй ещё раз.'
    );
  }
}
