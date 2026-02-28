/**
 * High-level game session orchestration.
 * Combines engine + Redis + DB operations.
 */
import { db } from '../db/client.js';
import {
  getSession,
  saveSession,
  publishEvent,
  openChallengeWindow,
  getChallengeWindow,
  closeChallengeWindow,
  updateLeaderboard,
} from '../redis/session.js';
import {
  validateMove,
  insertCard,
  resolveChallenge,
  applyScore,
  isGameOver,
  getWinners,
  drawCard,
  SCORE,
} from './engine.js';

const CHALLENGE_WINDOW_MS = parseInt(process.env.CHALLENGE_WINDOW_MS || '30000');
const MAX_CHAIN_LENGTH = parseInt(process.env.MAX_CHAIN_LENGTH || '10');

/**
 * Create a new game session in Redis + persist to DB.
 */
export async function createSession({ userId, deckId, type = 'SOLO', chatId = null }) {
  // Load deck cards
  const { rows: deckCards } = await db.query(
    'SELECT * FROM cards WHERE deck_id = $1 AND is_active = TRUE ORDER BY RANDOM()',
    [deckId]
  );
  if (!deckCards.length) throw new Error('No cards in deck');

  const { rows: [deck] } = await db.query('SELECT * FROM decks WHERE id = $1', [deckId]);
  if (!deck) throw new Error('Deck not found');

  // Insert session into DB
  const { rows: [session] } = await db.query(
    `INSERT INTO sessions (type, status, deck_id, chat_id, created_by, started_at)
     VALUES ($1, 'ACTIVE', $2, $3, $4, NOW())
     RETURNING id`,
    [type, deckId, chatId, userId]
  );

  const sessionId = session.id;

  // Add creator as player
  await db.query(
    'INSERT INTO session_players (session_id, user_id, turn_order) VALUES ($1, $2, 0)',
    [sessionId, userId]
  );

  // Draw starting card
  const startingCard = deckCards[0];
  const usedCardIds = new Set([startingCard.id]);

  // Build initial chain with starting card face-up
  const initialChain = [{
    cardId: startingCard.id,
    title: startingCard.title,
    subtitle: startingCard.subtitle,
    imageUrl: startingCard.image_url,
    hiddenValue: parseFloat(startingCard.hidden_value),
    displayValue: startingCard.display_value,
    isFaceDown: false,
    placedBy: null,
  }];

  // Draw player's first card
  const nextCard = deckCards[1] ?? null;
  if (nextCard) usedCardIds.add(nextCard.id);

  const redisSession = {
    id: sessionId,
    type,
    status: 'ACTIVE',
    deckId,
    deckName: deck.name,
    deckParameterName: deck.parameter_name,
    deckParameterUnit: deck.parameter_unit,
    chain: initialChain,
    usedCardIds: [...usedCardIds],
    allCardIds: deckCards.map((c) => c.id),
    players: {
      [String(userId)]: { score: 0, turnOrder: 0 },
    },
    currentTurn: nextCard
      ? {
          userId: String(userId),
          card: formatCard(nextCard),
          startedAt: new Date().toISOString(),
        }
      : null,
    pendingChallenge: null,
    chatId,
    createdAt: new Date().toISOString(),
  };

  await saveSession(sessionId, redisSession);
  return { sessionId, session: redisSession };
}

/**
 * Process a player's move.
 */
export async function processMove({ sessionId, userId, cardId, position, isBluff }) {
  const session = await getSession(sessionId);
  if (!session) throw new GameError('Session not found', 404);
  if (session.status !== 'ACTIVE') throw new GameError('Game is not active', 400);

  const turn = session.currentTurn;
  if (!turn || String(turn.userId) !== String(userId)) {
    throw new GameError('Not your turn', 403);
  }
  if (turn.card.cardId !== cardId) {
    throw new GameError('Card mismatch', 400);
  }

  let newChain;
  let turnStatus;
  let scoreDelta = 0;

  if (isBluff) {
    // Place face-down — no validation yet
    newChain = insertCard(session.chain, turn.card, position, true, userId);
    turnStatus = 'PENDING';

    // Record turn in DB
    const { rows: [dbTurn] } = await db.query(
      `INSERT INTO turns (session_id, user_id, card_id, proposed_position, is_bluff, status)
       VALUES ($1, $2, $3, $4, TRUE, 'PENDING') RETURNING id`,
      [sessionId, userId, cardId, position]
    );

    // Open challenge window
    await openChallengeWindow(sessionId, dbTurn.id, CHALLENGE_WINDOW_MS);

    session.pendingChallenge = {
      turnId: dbTurn.id,
      position,
      cardId,
      placerId: String(userId),
      expiresAt: Date.now() + CHALLENGE_WINDOW_MS,
    };
  } else {
    // Normal move — validate
    const { valid, reason } = validateMove(session.chain, turn.card, position);

    if (valid) {
      newChain = insertCard(session.chain, turn.card, position, false, userId);
      turnStatus = 'CORRECT';
      scoreDelta = SCORE.CORRECT_MOVE;
    } else {
      newChain = session.chain; // card not added
      turnStatus = 'INCORRECT';
      scoreDelta = 0;
    }

    await db.query(
      `INSERT INTO turns (session_id, user_id, card_id, proposed_position, is_bluff, status,
        score_delta_placer, resolved_at)
       VALUES ($1, $2, $3, $4, FALSE, $5, $6, NOW())`,
      [sessionId, userId, cardId, position, turnStatus, scoreDelta]
    );
  }

  // Apply score
  let players = session.players;
  if (scoreDelta !== 0) {
    players = applyScore(players, userId, scoreDelta);
    await updateLeaderboard(userId, scoreDelta, session.deckId);
  }

  // Check game over
  const usedIds = new Set(session.usedCardIds);
  const remaining = session.allCardIds.filter((id) => !usedIds.has(id));
  const gameOver = isGameOver(newChain, MAX_CHAIN_LENGTH, remaining.length);

  // Draw next card
  let nextCard = null;
  if (!gameOver && !isBluff) {
    const allCards = await getCardsForIds(remaining.slice(0, 20)); // fetch a batch
    nextCard = drawCard(allCards, usedIds);
    if (nextCard) usedIds.add(nextCard.id);
  }

  const updatedSession = {
    ...session,
    chain: newChain,
    players,
    usedCardIds: [...usedIds],
    currentTurn: nextCard
      ? { userId: String(userId), card: formatCard(nextCard), startedAt: new Date().toISOString() }
      : null,
    status: gameOver ? 'FINISHED' : 'ACTIVE',
  };

  await saveSession(sessionId, updatedSession);

  if (gameOver) {
    await finishSession(sessionId, updatedSession);
  }

  await publishEvent(sessionId, 'CHAIN_UPDATED', {
    chain: newChain,
    turnResult: { status: turnStatus, scoreDelta },
    players,
    nextCard: nextCard ? formatCard(nextCard) : null,
    gameOver,
    winners: gameOver ? getWinners(players) : null,
  });

  return { session: updatedSession, turnStatus, scoreDelta, nextCard };
}

/**
 * Process a challenge against the last bluff card.
 */
export async function processChallenge({ sessionId, challengerId }) {
  const session = await getSession(sessionId);
  if (!session) throw new GameError('Session not found', 404);

  const pending = session.pendingChallenge;
  if (!pending) throw new GameError('No pending challenge', 400);

  // Check window is still open
  const openTurnId = await getChallengeWindow(sessionId);
  if (!openTurnId || openTurnId !== String(pending.turnId)) {
    throw new GameError('Challenge window closed', 400);
  }

  if (String(challengerId) === String(pending.placerId)) {
    throw new GameError('Cannot challenge your own move', 400);
  }

  // Fetch the actual card from DB
  const { rows: [card] } = await db.query('SELECT * FROM cards WHERE id = $1', [pending.cardId]);
  if (!card) throw new GameError('Card not found', 500);

  const { bluffCaught, newChain, scoreDeltaPlacer, scoreDeltaChallenger, reason } =
    resolveChallenge(session.chain, pending.position, formatCard(card), pending.placerId, challengerId);

  let players = session.players;
  players = applyScore(players, pending.placerId, scoreDeltaPlacer);
  players = applyScore(players, challengerId, scoreDeltaChallenger);

  // Update leaderboard
  await Promise.all([
    updateLeaderboard(pending.placerId, scoreDeltaPlacer, session.deckId),
    updateLeaderboard(challengerId, scoreDeltaChallenger, session.deckId),
  ]);

  // Update turn in DB
  const finalStatus = bluffCaught ? 'BLUFF_CAUGHT' : 'BLUFF_HELD';
  await db.query(
    `UPDATE turns SET status = $1, challenged_by = $2,
     score_delta_placer = $3, score_delta_chall = $4, resolved_at = NOW()
     WHERE id = $5`,
    [finalStatus, challengerId, scoreDeltaPlacer, scoreDeltaChallenger, pending.turnId]
  );

  await closeChallengeWindow(sessionId);

  // Draw next card after challenge resolution
  const usedIds = new Set(session.usedCardIds);
  const remaining = session.allCardIds.filter((id) => !usedIds.has(id));
  const gameOver = isGameOver(newChain, MAX_CHAIN_LENGTH, remaining.length);

  let nextCard = null;
  if (!gameOver) {
    const allCards = await getCardsForIds(remaining.slice(0, 20));
    nextCard = drawCard(allCards, usedIds);
    if (nextCard) usedIds.add(nextCard.id);
  }

  const updatedSession = {
    ...session,
    chain: newChain,
    players,
    usedCardIds: [...usedIds],
    currentTurn: nextCard
      ? { userId: String(pending.placerId), card: formatCard(nextCard), startedAt: new Date().toISOString() }
      : null,
    pendingChallenge: null,
    status: gameOver ? 'FINISHED' : 'ACTIVE',
  };

  await saveSession(sessionId, updatedSession);

  if (gameOver) await finishSession(sessionId, updatedSession);

  await publishEvent(sessionId, 'CHALLENGE_END', {
    bluffCaught,
    reason,
    chain: newChain,
    players,
    scoreDeltaPlacer,
    scoreDeltaChallenger,
    revealedCard: { ...formatCard(card), displayValue: card.display_value },
    nextCard: nextCard ? formatCard(nextCard) : null,
    gameOver,
  });

  return { bluffCaught, reason, players, newChain };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function finishSession(sessionId, session) {
  await db.query(
    "UPDATE sessions SET status = 'FINISHED', finished_at = NOW() WHERE id = $1",
    [sessionId]
  );

  // Update user stats
  const winners = getWinners(session.players);
  for (const [userId, { score }] of Object.entries(session.players)) {
    const isWinner = winners.includes(userId);
    await db.query(
      `UPDATE users SET
        score_total = score_total + $1,
        games_total = games_total + 1,
        games_won   = games_won   + $2,
        games_lost  = games_lost  + $3,
        updated_at  = NOW()
       WHERE id = $4`,
      [score, isWinner ? 1 : 0, isWinner ? 0 : 1, userId]
    );
  }
}

async function getCardsForIds(ids) {
  if (!ids.length) return [];
  const { rows } = await db.query(
    'SELECT * FROM cards WHERE id = ANY($1)',
    [ids]
  );
  return rows;
}

function formatCard(card) {
  return {
    cardId: card.id,
    title: card.title,
    subtitle: card.subtitle || null,
    imageUrl: card.image_url || card.imageUrl,
    hiddenValue: parseFloat(card.hidden_value ?? card.hiddenValue),
    displayValue: card.display_value || card.displayValue,
    isFaceDown: card.isFaceDown ?? false,
    flavorText: card.flavor_text || null,
  };
}

class GameError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

export { GameError };
