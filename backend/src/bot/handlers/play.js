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
  const isGroup = ctx.chat.type === 'group' || ctx.chat.type === 'supergroup';
  const sessionType = isGroup ? 'GROUP' : 'SOLO';
  const chatId = isGroup ? ctx.chat.id : null;

  console.log('[Play] startGame called:', { userId, deckId, isGroup, sessionType });
  const loadingMsg = await ctx.reply('⏳ Создаём игру...');

  try {
    console.log('[Play] Creating session...');
    const { sessionId, session } = await createSession({
      userId,
      deckId,
      type: sessionType,
      chatId,
    });

    const startingCard = session.chain[0];
    const nextCard = session.currentTurn?.card;

    const miniAppUrl = buildMiniAppUrl(sessionId, isGroup);
    console.log('[Play] Session created:', {
      sessionId,
      deckName: session.deckName,
      miniAppUrl,
      buttonType: isGroup ? 'url' : 'webApp',
      gameType: sessionType,
    });

    console.log('[Play] Editing message with inline keyboard...');
    const buttons = isGroup
      ? [Markup.button.url('🎯 Открыть игру', miniAppUrl)]
      : [Markup.button.webApp('🎯 Открыть игру', miniAppUrl)];

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
        ...Markup.inlineKeyboard([buttons]),
      }
    );
    console.log('[Play] Message edited successfully');
  } catch (err) {
    console.error('[Play] Error:', {
      message: err.message,
      code: err.code,
      response: err.response?.body,
      status: err.response?.status,
      stack: err.stack,
    });
    try {
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        loadingMsg.message_id,
        null,
        '❌ Не удалось создать игру. Попробуй ещё раз.'
      );
    } catch (editErr) {
      console.error('[Play] Failed to edit error message:', editErr.message);
    }
  }
}

function buildMiniAppUrl(sessionId, isGroup) {
  const baseUrl = process.env.MINI_APP_URL;

  // For groups, optionally use Telegram deep link if bot username is configured
  if (isGroup && process.env.BOT_USERNAME && process.env.MINI_APP_SHORT_NAME) {
    return `https://t.me/${process.env.BOT_USERNAME}/${process.env.MINI_APP_SHORT_NAME}?startapp=${sessionId}`;
  }

  // Fallback: direct URL for both private and groups
  return `${baseUrl}?sessionId=${sessionId}`;
}
