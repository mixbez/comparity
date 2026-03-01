import { startGame } from './play.js';
import { processChallenge } from '../../game/session.js';

export async function handleCallback(ctx) {
  const data = ctx.callbackQuery.data;
  console.log('[Callback] Received:', { data, userId: ctx.from.id, chatId: ctx.chat?.id });

  // Deck selection from /start or /decks
  if (data.startsWith('deck:') || data.startsWith('play:')) {
    await ctx.answerCbQuery();
    const deckId = parseInt(data.split(':')[1]);
    return startGame(ctx, deckId);
  }

  // Challenge button
  if (data.startsWith('challenge:')) {
    console.log('[Callback] Processing challenge');
    const sessionId = data.split(':')[1];
    const challengerId = ctx.from.id;

    try {
      console.log('[Callback] Challenge data:', { sessionId, challengerId });
      await ctx.answerCbQuery();
      const result = await processChallenge({ sessionId, challengerId });
      console.log('[Callback] Challenge resolved:', { bluffCaught: result.bluffCaught });
      const icon = result.bluffCaught ? '🎯' : '🛡';
      const msg = result.bluffCaught
        ? `${icon} Блеф пойман! Карта убрана из цепочки.`
        : `${icon} Блеф устоял! Карта раскрыта и остаётся.`;

      await ctx.reply(msg + `\n\n📊 Обновлённые очки:` +
        Object.entries(result.players)
          .map(([uid, p]) => `\n  ID ${uid}: ${p.score} очков`)
          .join('')
      );
      console.log('[Callback] Challenge reply sent successfully');
    } catch (err) {
      console.error('[Callback] Challenge error:', {
        message: err.message,
        code: err.code,
        response: err.response?.body,
        status: err.response?.status,
      });
      await ctx.answerCbQuery(err.message, { show_alert: true });
    }
    return;
  }
}
