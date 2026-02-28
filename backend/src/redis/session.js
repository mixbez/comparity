import { redis } from './client.js';

const SESSION_TTL = parseInt(process.env.SESSION_TTL_S || '3600');
const PREFIX = 'game:session:';

/**
 * @param {string} sessionId
 * @returns {Promise<Object|null>}
 */
export async function getSession(sessionId) {
  const raw = await redis.get(`${PREFIX}${sessionId}`);
  return raw ? JSON.parse(raw) : null;
}

/**
 * @param {string} sessionId
 * @param {Object} session
 */
export async function saveSession(sessionId, session) {
  session.updatedAt = new Date().toISOString();
  await redis.set(`${PREFIX}${sessionId}`, JSON.stringify(session), 'EX', SESSION_TTL);
}

/**
 * @param {string} sessionId
 */
export async function deleteSession(sessionId) {
  await redis.del(`${PREFIX}${sessionId}`);
}

/**
 * Publish a real-time event to session channel
 * @param {string} sessionId
 * @param {string} type
 * @param {Object} payload
 */
export async function publishEvent(sessionId, type, payload) {
  const channel = `game:updates:${sessionId}`;
  await redis.publish(channel, JSON.stringify({ type, payload, ts: Date.now() }));
}

/**
 * Set a challenge window key with TTL (used to detect if challenge is open)
 * @param {string} sessionId
 * @param {number} turnId
 * @param {number} windowMs
 */
export async function openChallengeWindow(sessionId, turnId, windowMs) {
  const key = `game:challenge:${sessionId}`;
  await redis.set(key, String(turnId), 'PX', windowMs);
}

/**
 * @param {string} sessionId
 * @returns {Promise<string|null>} turnId if window is open, else null
 */
export async function getChallengeWindow(sessionId) {
  return redis.get(`game:challenge:${sessionId}`);
}

/**
 * Close (delete) the challenge window key
 */
export async function closeChallengeWindow(sessionId) {
  await redis.del(`game:challenge:${sessionId}`);
}

// Leaderboard helpers
export async function updateLeaderboard(userId, scoreDelta, deckId = null) {
  await redis.zincrby('leaderboard:global', scoreDelta, String(userId));
  if (deckId) {
    await redis.zincrby(`leaderboard:deck:${deckId}`, scoreDelta, String(userId));
  }
}

export async function getLeaderboard(deckId = null, limit = 10) {
  const key = deckId ? `leaderboard:deck:${deckId}` : 'leaderboard:global';
  const entries = await redis.zrevrange(key, 0, limit - 1, 'WITHSCORES');
  const result = [];
  for (let i = 0; i < entries.length; i += 2) {
    result.push({ userId: entries[i], score: parseInt(entries[i + 1]) });
  }
  return result;
}
