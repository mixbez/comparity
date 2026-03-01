import { startGame } from './play.js';
import { createSession, processChallenge } from '../../game/session.js';
import { getSession } from '../../redis/session.js';
import { Markup } from 'telegraf';

export async function handleCallback(ctx) {
  const data = ctx.callbackQuery.data;

  // Deck selection from /start or /decks
  if (data.startsWith('deck:') || data.startsWith('play:')) {
    await ctx.answerCbQuery();
    const deckId = parseInt(data.split(':')[1]);
    return startGame(ctx, deckId);
  }

  // Group game start (from inline message) — manages answerCbQuery itself
  if (data.startsWith('group_start:')) {
    const deckId = parseInt(data.split(':')[1]);
    const userId = ctx.from.id;
    // For inline messages ctx.chat is null — get chatId from message if available
    const chatId = ctx.callbackQuery.message?.chat?.id ?? null;

    try {
      const { sessionId, session } = await createSession({
        userId,
        deckId,
        type: 'GROUP',
        chatId,
      });

      const startingCard = session.chain[0];
      const nextCard = session.currentTurn?.card;
      const miniAppUrl = `${process.env.MINI_APP_URL}?sessionId=${sessionId}`;

      await ctx.editMessageText(
        `🎮 *Групповая игра: ${session.deckName}*\n\n` +
        `📏 Параметр: *${session.deckParameterName}*\n\n` +
        `🃏 Цепочка начата с: *${startingCard.title}* (${startingCard.displayValue})\n\n` +
        `Следующая карта: *${nextCard?.title || '?'}*\nКуда её поставить?`,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.webApp('🎯 Открыть игру', miniAppUrl)],
            [Markup.button.callback('⚔️ Оспорить!', `challenge:${sessionId}`)],
          ]),
        }
      );
      await ctx.answerCbQuery();
    } catch (err) {
      console.error('[Callback] group_start error:', err.message, err.stack);
      await ctx.answerCbQuery(`Ошибка: ${err.message}`, { show_alert: true }).catch(() => {});
    }
    return;
  }

  // For all other callbacks answer immediately
  await ctx.answerCbQuery();

  // Deck selection from /start or /decks
  if (data.startsWith('deck:') || data.startsWith('play:')) {
    const deckId = parseInt(data.split(':')[1]);
    return startGame(ctx, deckId);
  }

  // Challenge button
  if (data.startsWith('challenge:')) {
    const sessionId = data.split(':')[1];
    const challengerId = ctx.from.id;

    try {
      await ctx.answerCbQuery();
      const result = await processChallenge({ sessionId, challengerId });
      const icon = result.bluffCaught ? '🎯' : '🛡';
      const msg = result.bluffCaught
        ? `${icon} Блеф пойман! Карта убрана из цепочки.`
        : `${icon} Блеф устоял! Карта раскрыта и остаётся.`;

      await ctx.reply(msg + `\n\n📊 Обновлённые очки:` +
        Object.entries(result.players)
          .map(([uid, p]) => `\n  ID ${uid}: ${p.score} очков`)
          .join('')
      );
    } catch (err) {
      await ctx.answerCbQuery(err.message, { show_alert: true }).catch(() => {});
    }
    return;
  }

  await ctx.answerCbQuery();
}
