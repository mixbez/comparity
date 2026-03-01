import { db } from '../../db/client.js';
import { getSession, deleteSession, publishEvent, closeChallengeWindow } from '../../redis/session.js';

export async function handleStop(ctx) {
  const userId = ctx.from.id;

  // Find the user's latest active session
  const { rows } = await db.query(
    `SELECT id FROM sessions
     WHERE created_by = $1 AND status = 'ACTIVE'
     ORDER BY started_at DESC
     LIMIT 1`,
    [userId]
  );

  if (!rows.length) {
    return ctx.reply('У тебя нет активной игры. Начни новую с /play');
  }

  const sessionId = rows[0].id;
  const session = await getSession(sessionId);

  // Mark as abandoned in DB
  await db.query(
    "UPDATE sessions SET status = 'ABANDONED', finished_at = NOW() WHERE id = $1",
    [sessionId]
  );

  // Clean up Redis
  await closeChallengeWindow(sessionId);
  if (session) {
    await publishEvent(sessionId, 'GAME_ABANDONED', { reason: 'player_quit' });
  }
  await deleteSession(sessionId);

  const chainLength = session?.chain?.length ?? 0;
  const score = session?.players?.[String(userId)]?.score ?? 0;

  await ctx.reply(
    `🛑 *Игра завершена*\n\n` +
    `📏 Длина цепочки: *${chainLength}* карт\n` +
    `💎 Очков за игру: *${score}*\n\n` +
    `Хочешь сыграть снова? /play`,
    { parse_mode: 'Markdown' }
  );
}
