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

export async function handleGroupStart(ctx) {
  const data = ctx.callbackQuery.data;
  const deckId = parseInt(data.split(':')[1]);
  await ctx.answerCbQuery();
  await startGame(ctx, deckId);
}

export async function startGame(ctx, deckId) {
  const userId = ctx.from.id;
  const chatType = ctx.chat?.type;
  const isGroup = chatType === 'group' || chatType === 'supergroup';
  const gameType = isGroup ? 'GROUP' : 'SOLO';
  const chatId = ctx.chat?.id;
  console.log('[Play] startGame called:', { userId, deckId, gameType, chatType, chatId });
  const loadingMsg = await ctx.reply('⏳ Создаём игру...');

  try {
    const { sessionId, session } = await createSession({
      userId,
      deckId,
      type: gameType,
      chatId,
    });

    const startingCard = session.chain[0];
    const nextCard = session.currentTurn?.card;
    const botUsername = ctx.botInfo?.username;
    const miniAppUrl = buildMiniAppUrl(sessionId, isGroup, botUsername);

    console.log('[Play] Session created:', {
      sessionId,
      deckName: session.deckName,
      miniAppUrl,
      buttonType: isGroup ? 'url' : 'webApp',
    });

    // Use url button for groups (webApp buttons only work in private chats),
    // webApp button for private chats (enables Telegram Mini App API)
    const button = isGroup
      ? Markup.button.url('🎯 Открыть игру', miniAppUrl)
      : Markup.button.webApp('🎯 Открыть игру', miniAppUrl);

    // Delete loading message and send the game message
    await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id).catch(() => {});

    await ctx.reply(
      `🎮 *Игра началась!*\n\n` +
      `📦 Колода: *${session.deckName}*\n` +
      `📏 Параметр: *${session.deckParameterName}*\n\n` +
      `🃏 Стартовая карточка:\n` +
      `*${startingCard.title}* — ${startingCard.displayValue}\n\n` +
      `Твоя карточка: *${nextCard?.title || '?'}*\n` +
      `Куда её поставить в цепочке?`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([[button]]),
      }
    );
    console.log('[Play] Game message sent successfully');
  } catch (err) {
    console.error('[Play] Error:', {
      message: err.message,
      code: err.code,
      response: err.response?.body,
      status: err.response?.status,
      stack: err.stack,
    });
    await ctx.reply('❌ Не удалось создать игру. Попробуй ещё раз.');
  }
}

function buildMiniAppUrl(sessionId, isGroup, botUsername) {
  const appShortName = process.env.MINI_APP_SHORT_NAME;

  // For groups: use Telegram deep link so Mini App opens inside Telegram
  // (not in external browser). Requires MINI_APP_SHORT_NAME from BotFather.
  if (isGroup && botUsername && appShortName) {
    return `https://t.me/${botUsername}/${appShortName}?startapp=${sessionId}`;
  }

  // For private chats (webApp button) or fallback
  return `${process.env.MINI_APP_URL}?sessionId=${sessionId}`;
}
