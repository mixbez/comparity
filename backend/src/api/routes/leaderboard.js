import { getLeaderboard } from '../../redis/session.js';
import { getTopPlayers } from '../../db/models/user.js';

export async function leaderboardRoutes(fastify) {
  fastify.get('/', async (request) => {
    const deckId = request.query.deckId ? parseInt(request.query.deckId) : null;

    // Try Redis leaderboard first
    const redisEntries = await getLeaderboard(deckId, 10);

    if (redisEntries.length) {
      return { source: 'cache', entries: redisEntries };
    }

    // Fallback to DB
    const dbEntries = await getTopPlayers(10);
    return {
      source: 'db',
      entries: dbEntries.map((u) => ({
        userId: String(u.id),
        firstName: u.first_name,
        username: u.username,
        score: u.score_total,
        gamesTotal: u.games_total,
      })),
    };
  });
}
