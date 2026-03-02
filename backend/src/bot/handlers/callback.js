import { startGame, handleGroupStart } from './play.js';
import { processChallenge, joinSession } from '../../game/session.js';

export async function handleCallback(ctx) {
  const data = ctx.callbackQuery.data;
  console.log('[Callback] Received:', { data, userId: ctx.from.id, chatId: ctx.chat?.id });

  // Group game start from inline query
  if (data.startsWith('group_start:')) {
    return handleGroupStart(ctx);
  }

  // Deck selection from /start or /decks
  if (data.startsWith('deck:') || data.startsWith('play:')) {
    await ctx.answerCbQuery();
    const deckId = parseInt(data.split(':')[1]);
    return startGame(ctx, deckId);
  }

  // Join game
  if (data.startsWith('join:')) {
    const sessionId = data.split(':')[1];
    const userId = ctx.from.id;

    try {
      await ctx.answerCbQuery();
      const { session, joined } = await joinSession({ sessionId, userId });

      if (!joined) {
        await ctx.reply('Ты уже в игре!');
      } else {
        const handCount = session.players[String(userId)]?.hand?.length ?? 0;
        await ctx.reply(
          `🤝 *${ctx.from.first_name}* присоединился к игре!\n` +
          `🃏 Получено ${handCount} карт.`,
          { parse_mode: 'Markdown' }
        );
      }
    } catch (err) {
      console.error('[Callback] Join error:', err.message);
      await ctx.answerCbQuery(err.message, { show_alert: true });
    }
    return;
  }

  // Challenge button (from group chat inline buttons)
  if (data.startsWith('challenge:')) {
    console.log('[Callback] Processing challenge');
    const sessionId = data.split(':')[1];
    const challengerId = ctx.from.id;

    try {
      console.log('[Callback] Challenge data:', { sessionId, challengerId });
      await ctx.answerCbQuery();
      const result = await processChallenge({ sessionId, challengerId });
      console.log('[Callback] Challenge resolved:', { chainValid: result.chainValid });

      const icon = result.chainValid ? '✅' : '❌';
      const msg = result.chainValid
        ? `${icon} Цепочка верна! Оспоривший получает штрафные карты.`
        : `${icon} Порядок нарушен! Нарушитель получает штрафные карты.`;

      await ctx.reply(msg);
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

  // Unhandled callback — dismiss loading indicator
  await ctx.answerCbQuery();
}
