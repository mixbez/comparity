import { getUserStats } from '../../db/models/user.js';
import { getLeaderboard } from '../../redis/session.js';

export async function handleStats(ctx) {
  const userId = ctx.from.id;
  const stats = await getUserStats(userId);

  if (!stats) {
    return ctx.reply('Ты ещё не играл. Начни с /play!');
  }

  const winRate = stats.games_total > 0
    ? Math.round((stats.games_won / stats.games_total) * 100)
    : 0;

  // Top 5 leaderboard
  const leaders = await getLeaderboard(null, 5);

  let leaderText = '';
  if (leaders.length) {
    leaderText = '\n\n🏆 *Топ-5 игроков:*\n';
    leaders.forEach((entry, i) => {
      const medal = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'][i];
      leaderText += `${medal} ID ${entry.userId} — ${entry.score} очков\n`;
    });
  }

  await ctx.reply(
    `📊 *Статистика ${stats.first_name}*\n\n` +
    `💎 Очков: *${stats.score_total}*\n` +
    `🎮 Игр сыграно: *${stats.games_total}*\n` +
    `✅ Побед: *${stats.games_won}*\n` +
    `❌ Поражений: *${stats.games_lost}*\n` +
    `📈 Винрейт: *${winRate}%*` +
    leaderText,
    { parse_mode: 'Markdown' }
  );
}
