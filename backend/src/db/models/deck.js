import { db } from '../client.js';

export async function getAllDecks() {
  const { rows } = await db.query(
    'SELECT * FROM decks WHERE is_active = TRUE ORDER BY id'
  );
  return rows;
}

export async function getDeckById(id) {
  const { rows } = await db.query('SELECT * FROM decks WHERE id = $1', [id]);
  return rows[0] || null;
}

export async function getDeckCards(deckId) {
  const { rows } = await db.query(
    'SELECT * FROM cards WHERE deck_id = $1 AND is_active = TRUE ORDER BY hidden_value',
    [deckId]
  );
  return rows;
}
