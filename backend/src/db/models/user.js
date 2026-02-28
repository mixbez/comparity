import { db } from '../client.js';

export async function upsertUser({ id, username, firstName, lastName }) {
  await db.query(
    `INSERT INTO users (id, username, first_name, last_name)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (id) DO UPDATE SET
       username   = EXCLUDED.username,
       first_name = EXCLUDED.first_name,
       last_name  = EXCLUDED.last_name,
       updated_at = NOW()`,
    [id, username, firstName, lastName]
  );
}

export async function getUserStats(userId) {
  const { rows } = await db.query(
    `SELECT id, first_name, username, score_total, games_won, games_lost, games_total
     FROM users WHERE id = $1`,
    [userId]
  );
  return rows[0] || null;
}

export async function getTopPlayers(limit = 10) {
  const { rows } = await db.query(
    `SELECT id, first_name, username, score_total, games_total
     FROM users ORDER BY score_total DESC LIMIT $1`,
    [limit]
  );
  return rows;
}
