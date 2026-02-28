import { Telegraf, Markup, session } from 'telegraf';
import { handleStart } from './handlers/start.js';
import { handlePlay } from './handlers/play.js';
import { handleStats } from './handlers/stats.js';
import { handleDecks } from './handlers/decks.js';
import { handleInlineQuery } from './handlers/inline.js';
import { handleCallback } from './handlers/callback.js';
import { upsertUser } from '../db/models/user.js';

export function createBot() {
  const bot = new Telegraf(process.env.BOT_TOKEN);

  // Middleware: upsert user on every interaction
  bot.use(async (ctx, next) => {
    const user = ctx.from;
    if (user) {
      await upsertUser({
        id: user.id,
        username: user.username || null,
        firstName: user.first_name,
        lastName: user.last_name || null,
      }).catch(console.error);
    }
    return next();
  });

  // Commands
  bot.start(handleStart);
  bot.command('play', handlePlay);
  bot.command('stats', handleStats);
  bot.command('decks', handleDecks);
  bot.command('help', (ctx) =>
    ctx.reply(
      '📖 *Comparity* — игра в сравнение!\n\n' +
      '/play — начать новую игру\n' +
      '/decks — выбрать колоду\n' +
      '/stats — твоя статистика\n',
      { parse_mode: 'Markdown' }
    )
  );

  // Inline mode (for group games)
  bot.on('inline_query', handleInlineQuery);

  // Callback buttons
  bot.on('callback_query', handleCallback);

  // Error handler
  bot.catch((err, ctx) => {
    console.error(`[Bot] Error for ${ctx.updateType}:`, err.message);
    ctx.reply('Что-то пошло не так. Попробуй ещё раз /play').catch(() => {});
  });

  return bot;
}
