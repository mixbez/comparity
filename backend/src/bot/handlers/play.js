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
  console.log('[Play] startGame called:', { userId, deckId });
  const loadingMsg = await ctx.reply('⏳ Создаём игру...');

  try {
    console.log('[Play] Creating session...');
    const { sessionId, session } = await createSession({
      userId,
      deckId,
      type: 'SOLO',
    });

    const startingCard = session.chain[0];
    const nextCard = session.currentTurn?.card;

    const miniAppUrl = `${process.env.MINI_APP_URL}?sessionId=${sessionId}`;
    console.log('[Play] Session created:', {
      sessionId,
      deckName: session.deckName,
      miniAppUrl,
      miniAppUrlType: typeof miniAppUrl,
    });

    console.log('[Play] Sending game message with webApp button...');

    // Delete loading message
    await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id).catch(() => {});

    // Build reply markup manually
    const replyMarkup = {
      inline_keyboard: [
        [
          {
            text: '🎯 Открыть игру',
            web_app: { url: miniAppUrl },
          },
        ],
      ],
    };

    console.log('[Play] Reply markup structure:', JSON.stringify(replyMarkup, null, 2));
    console.log('[Play] Button details:', {
      text: '🎯 Открыть игру',
      web_app_url: miniAppUrl,
      web_app_url_type: typeof miniAppUrl,
      web_app_url_length: miniAppUrl?.length,
      web_app_url_valid: miniAppUrl?.startsWith('http'),
    });

    // Send new message with webApp button (manual button creation)
    const result = await ctx.reply(
      `🎮 *Игра началась!*\n\n` +
      `📦 Колода: *${session.deckName}*\n` +
      `📏 Параметр: *${session.deckParameterName}*\n\n` +
      `🃏 Стартовая карточка:\n` +
      `*${startingCard.title}* — ${startingCard.displayValue}\n\n` +
      `Твоя карточка: *${nextCard?.title || '?'}*\n` +
      `Куда её поставить в цепочке?`,
      {
        parse_mode: 'Markdown',
        reply_markup: replyMarkup,
      }
    );
    console.log('[Play] Message sent successfully:', { message_id: result.message_id });
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
