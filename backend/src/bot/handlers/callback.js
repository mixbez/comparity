import { startGame } from './play.js';
import { createSession, processChallenge } from '../../game/session.js';
import { getSession } from '../../redis/session.js';
import { Markup } from 'telegraf';

export async function handleCallback(ctx) {
  const data = ctx.callbackQuery.data;
  console.log('[Callback] Received:', { data, userId: ctx.from.id, chatId: ctx.chat?.id });

  // Deck selection from /start or /decks
  if (data.startsWith('deck:') || data.startsWith('play:')) {
    await ctx.answerCbQuery();
    const deckId = parseInt(data.split(':')[1]);
    return startGame(ctx, deckId);
  }

  // Group game start (from inline message) — manages answerCbQuery itself
  if (data.startsWith('group_start:')) {
    console.log('[Callback] Processing group_start');
    const deckId = parseInt(data.split(':')[1]);
    const userId = ctx.from.id;

    // Debug: check all possible sources of chat ID
    console.log('[Callback] Debug chat info:', {
      'ctx.chat?.id': ctx.chat?.id,
      'ctx.callbackQuery.message?.chat?.id': ctx.callbackQuery.message?.chat?.id,
      'ctx.callbackQuery.message?.chat': ctx.callbackQuery.message?.chat,
      'ctx.callbackQuery.inline_message_id': ctx.callbackQuery.inline_message_id,
      'ctx.callbackQuery.message?.message_id': ctx.callbackQuery.message?.message_id,
    });

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

      console.log('[Callback] group_start data:', {
        sessionId,
        deckName: session.deckName,
        miniAppUrl,
        buttonsCount: 2,
        buttonTypes: ['webApp', 'callback'],
      });

      // Send new message with webApp button (inline messages don't support webApp)
      // Use sendMessage instead of reply because callback queries don't support reply()
      const sendChatId = chatId || ctx.from.id; // Use chat ID if from group, else DM the user
      await ctx.telegram.sendMessage(
        sendChatId,
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
      console.log('[Callback] group_start success: message edited and callback answered');
    } catch (err) {
      console.error('[Callback] group_start error:', {
        message: err.message,
        code: err.code,
        response: err.response?.body,
        status: err.response?.status,
        stack: err.stack,
      });
      await ctx.answerCbQuery(`Ошибка: ${err.message}`, { show_alert: true }).catch(() => {});
    }
    return;
  }

  // For all other callbacks answer immediately
  await ctx.answerCbQuery();

  // Deck selection from /start or /decks
  if (data.startsWith('deck:') || data.startsWith('play:')) {
    const deckId = parseInt(data.split(':')[1]);
    console.log('[Callback] Deck selection:', { deckId });
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

  await ctx.answerCbQuery();
}
