/**
 * High-level game session orchestration.
 * Combines engine + Redis + DB operations.
 *
 * New rules: hand-based gameplay, face-down placement, chain challenge.
 */
import { db } from '../db/client.js';
import {
  getSession,
  saveSession,
  publishEvent,
  updateLeaderboard,
} from '../redis/session.js';
import {
  drawCards,
  drawCard,
  insertCard,
  resolveChallenge,
  applyScore,
  isGameOver,
  getWinners,
  getNextPlayerIndex,
  SCORE,
  DEFAULT_HAND_SIZE,
} from './engine.js';

/**
 * Create a new game session in Redis + persist to DB.
 */
export async function createSession({ userId, deckId, type = 'GROUP', chatId = null }) {
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
  const usedCardIds = new Set();

  // Draw anchor card (face-up on table)
  const anchorCard = deckCards[0];
  usedCardIds.add(anchorCard.id);

  const initialChain = [{
    cardId: anchorCard.id,
    title: anchorCard.title,
    subtitle: anchorCard.subtitle,
    imageUrl: anchorCard.image_url,
    hiddenValue: parseFloat(anchorCard.hidden_value),
    displayValue: anchorCard.display_value,
    isFaceDown: false,
    placedBy: null,
    turnNumber: 0,
  }];

  // Deal hand to creator
  const { drawn: hand, newUsedIds } = drawCards(deckCards, usedCardIds, DEFAULT_HAND_SIZE);

  // Add creator as player in DB
  await db.query(
    'INSERT INTO session_players (session_id, user_id, turn_order) VALUES ($1, $2, 0)',
    [sessionId, userId]
  );

  const redisSession = {
    id: sessionId,
    type,
    status: 'ACTIVE',
    deckId,
    deckName: deck.name,
    deckParameterName: deck.parameter_name,
    deckParameterUnit: deck.parameter_unit,
    chain: initialChain,
    usedCardIds: [...newUsedIds],
    allCardIds: deckCards.map((c) => c.id),
    players: {
      [String(userId)]: {
        score: 0,
        turnOrder: 0,
        hand: hand.map(formatFullCard),
      },
    },
    turnOrder: [String(userId)],
    currentPlayerIndex: 0,
    turnCounter: 1,
    lastMoveBy: null,
    chatId,
    createdAt: new Date().toISOString(),
  };

  await saveSession(sessionId, redisSession);
  return { sessionId, session: redisSession };
}

/**
 * Join an existing game session (for GROUP mode).
 */
export async function joinSession({ sessionId, userId }) {
  const session = await getSession(sessionId);
  if (!session) throw new GameError('Session not found', 404);

  const uid = String(userId);
  if (session.players[uid]) throw new GameError('Already in this game', 400);
  if (session.status !== 'ACTIVE') {
    throw new GameError('Cannot join this game', 400);
  }

  // Deal hand from remaining deck
  const usedIds = new Set(session.usedCardIds);
  const remaining = session.allCardIds.filter((id) => !usedIds.has(id));
  const allCards = await getCardsForIds(remaining.slice(0, Math.max(DEFAULT_HAND_SIZE * 2, 20)));
  const { drawn: hand, newUsedIds } = drawCards(allCards, usedIds, DEFAULT_HAND_SIZE);

  const newTurnOrder = session.turnOrder.length;

  await db.query(
    'INSERT INTO session_players (session_id, user_id, turn_order) VALUES ($1, $2, $3)',
    [sessionId, userId, newTurnOrder]
  );

  const updatedSession = {
    ...session,
    usedCardIds: [...newUsedIds],
    players: {
      ...session.players,
      [uid]: {
        score: 0,
        turnOrder: newTurnOrder,
        hand: hand.map(formatFullCard),
      },
    },
    turnOrder: [...session.turnOrder, uid],
  };

  await saveSession(sessionId, updatedSession);

  await publishEvent(sessionId, 'PLAYER_JOINED', {
    userId: uid,
    playerCount: updatedSession.turnOrder.length,
    playersInfo: getPlayersInfo(updatedSession.players),
  });

  return { session: updatedSession };
}

/**
 * Process a player's move: place a card from hand into the chain (face-down).
 */
export async function processMove({ sessionId, userId, cardId, position }) {
  const session = await getSession(sessionId);
  if (!session) throw new GameError('Session not found', 404);
  if (session.status !== 'ACTIVE') throw new GameError('Game is not active', 400);

  const uid = String(userId);
  const currentPlayerId = session.turnOrder[session.currentPlayerIndex];
  if (uid !== currentPlayerId) throw new GameError('Not your turn', 403);

  // Find card in player's hand
  const player = session.players[uid];
  if (!player) throw new GameError('Not in this game', 403);

  const cardIndex = player.hand.findIndex((c) => c.cardId === cardId);
  if (cardIndex === -1) throw new GameError('Card not in your hand', 400);

  const card = player.hand[cardIndex];

  if (position < 0 || position > session.chain.length) {
    throw new GameError('Invalid position', 400);
  }

  // Place card face-down into chain
  const turnNumber = session.turnCounter;
  const newChain = insertCard(session.chain, card, position, true, uid, turnNumber);

  // Remove card from hand
  const newHand = [...player.hand];
  newHand.splice(cardIndex, 1);

  const updatedPlayers = {
    ...session.players,
    [uid]: { ...player, hand: newHand },
  };

  // Check game over (player emptied their hand)
  const gameOver = isGameOver(updatedPlayers);

  // Advance turn to next player
  const nextPlayerIndex = getNextPlayerIndex(
    session.currentPlayerIndex,
    session.turnOrder.length
  );

  // Record turn in DB
  await db.query(
    `INSERT INTO turns (session_id, user_id, card_id, proposed_position, is_bluff, status, resolved_at)
     VALUES ($1, $2, $3, $4, FALSE, 'ACCEPTED', NOW())`,
    [sessionId, userId, cardId, position]
  );

  const updatedSession = {
    ...session,
    chain: newChain,
    players: updatedPlayers,
    currentPlayerIndex: nextPlayerIndex,
    turnCounter: turnNumber + 1,
    lastMoveBy: uid,
    status: gameOver ? 'FINISHED' : 'ACTIVE',
  };

  await saveSession(sessionId, updatedSession);

  if (gameOver) {
    await finishSession(sessionId, updatedSession);
  }

  const winners = gameOver ? getWinners(updatedPlayers) : null;

  await publishEvent(sessionId, 'CHAIN_UPDATED', {
    chain: sanitizeChain(newChain),
    currentPlayerIndex: nextPlayerIndex,
    currentPlayerId: session.turnOrder[nextPlayerIndex],
    lastMoveBy: uid,
    playersInfo: getPlayersInfo(updatedPlayers),
    gameOver,
    winners,
  });

  return { session: updatedSession, gameOver, winners };
}

/**
 * Process a challenge ("Не верю!").
 * The current player challenges the chain instead of placing a card.
 */
export async function processChallenge({ sessionId, challengerId }) {
  const session = await getSession(sessionId);
  if (!session) throw new GameError('Session not found', 404);
  if (session.status !== 'ACTIVE') throw new GameError('Game is not active', 400);

  const uid = String(challengerId);
  const currentPlayerId = session.turnOrder[session.currentPlayerIndex];

  if (uid !== currentPlayerId) {
    throw new GameError('Not your turn', 403);
  }

  if (!session.lastMoveBy) {
    throw new GameError('No moves to challenge', 400);
  }

  if (uid === session.lastMoveBy) {
    throw new GameError('Cannot challenge right after your own move', 400);
  }

  // Chain must have player-placed cards (more than just anchor)
  if (session.chain.length <= 1) {
    throw new GameError('Nothing to challenge', 400);
  }

  // Resolve challenge — reveals and validates entire chain
  const {
    chainValid, revealedChain, penaltyPlayer, penaltyCards,
    invalidPositions, reason,
  } = resolveChallenge(session.chain, uid);

  let updatedPlayers = { ...session.players };
  // Deep copy hands
  for (const [pid, p] of Object.entries(updatedPlayers)) {
    updatedPlayers[pid] = { ...p, hand: [...(p.hand || [])] };
  }

  let usedIds = new Set(session.usedCardIds);

  // Apply penalty: loser draws extra cards from deck
  if (penaltyPlayer && penaltyCards > 0) {
    const remaining = session.allCardIds.filter((id) => !usedIds.has(id));

    if (remaining.length > 0) {
      const cardsToFetch = remaining.slice(0, Math.max(penaltyCards * 2, 10));
      const allCards = await getCardsForIds(cardsToFetch);
      const { drawn, newUsedIds } = drawCards(allCards, usedIds, penaltyCards);
      usedIds = newUsedIds;

      const penaltyPlayerData = updatedPlayers[penaltyPlayer];
      updatedPlayers[penaltyPlayer] = {
        ...penaltyPlayerData,
        hand: [...penaltyPlayerData.hand, ...drawn.map(formatFullCard)],
      };
    }

    // Apply score
    if (chainValid) {
      updatedPlayers = applyScore(updatedPlayers, uid, SCORE.CHALLENGE_LOSE);
    } else {
      updatedPlayers = applyScore(updatedPlayers, uid, SCORE.CHALLENGE_WIN);
      updatedPlayers = applyScore(updatedPlayers, penaltyPlayer, SCORE.PENALTY);
    }
  }

  // Update leaderboard
  if (chainValid) {
    await updateLeaderboard(uid, SCORE.CHALLENGE_LOSE, session.deckId);
  } else if (penaltyPlayer) {
    await Promise.all([
      updateLeaderboard(uid, SCORE.CHALLENGE_WIN, session.deckId),
      updateLeaderboard(penaltyPlayer, SCORE.PENALTY, session.deckId),
    ]);
  }

  // Record challenge in DB
  const lastChainCard = session.chain[session.chain.length - 1];
  await db.query(
    `INSERT INTO turns (session_id, user_id, card_id, proposed_position, is_bluff, status,
      challenged_by, score_delta_placer, score_delta_chall, resolved_at)
     VALUES ($1, $2, $3, 0, FALSE, $4, $5, $6, $7, NOW())`,
    [
      sessionId,
      penaltyPlayer || uid,
      lastChainCard?.cardId || 0,
      chainValid ? 'BLUFF_HELD' : 'BLUFF_CAUGHT',
      challengerId,
      chainValid ? 0 : SCORE.PENALTY,
      chainValid ? SCORE.CHALLENGE_LOSE : SCORE.CHALLENGE_WIN,
    ]
  );

  // Start new round: clear chain, draw new anchor
  let newChain = [];
  let gameOver = isGameOver(updatedPlayers);

  if (!gameOver) {
    const remainingAfterPenalty = session.allCardIds.filter((id) => !usedIds.has(id));

    if (remainingAfterPenalty.length > 0) {
      const anchorCards = await getCardsForIds(remainingAfterPenalty.slice(0, 1));
      if (anchorCards.length > 0) {
        const anchor = anchorCards[0];
        usedIds.add(anchor.id);
        newChain = [{
          cardId: anchor.id,
          title: anchor.title,
          subtitle: anchor.subtitle,
          imageUrl: anchor.image_url,
          hiddenValue: parseFloat(anchor.hidden_value),
          displayValue: anchor.display_value,
          isFaceDown: false,
          placedBy: null,
          turnNumber: 0,
        }];
      }
    }

    // No cards left for new anchor — game ends
    if (newChain.length === 0) {
      gameOver = true;
    }
  }

  // Move to next player for new round
  const nextPlayerIndex = getNextPlayerIndex(
    session.currentPlayerIndex,
    session.turnOrder.length
  );

  const updatedSession = {
    ...session,
    chain: newChain,
    players: updatedPlayers,
    usedCardIds: [...usedIds],
    currentPlayerIndex: nextPlayerIndex,
    turnCounter: 1, // reset for new round
    lastMoveBy: null,
    status: gameOver ? 'FINISHED' : 'ACTIVE',
  };

  await saveSession(sessionId, updatedSession);

  if (gameOver) {
    await finishSession(sessionId, updatedSession);
  }

  const winners = gameOver ? getWinners(updatedPlayers) : null;

  await publishEvent(sessionId, 'CHALLENGE_RESULT', {
    challengerId: uid,
    chainValid,
    revealedChain,
    invalidPositions,
    penaltyPlayer,
    penaltyCards,
    reason,
    newChain: sanitizeChain(newChain),
    playersInfo: getPlayersInfo(updatedPlayers),
    currentPlayerIndex: nextPlayerIndex,
    currentPlayerId: session.turnOrder[nextPlayerIndex],
    gameOver,
    winners,
  });

  return { chainValid, revealedChain, penaltyPlayer, invalidPositions, reason, gameOver, winners };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function finishSession(sessionId, session) {
  await db.query(
    "UPDATE sessions SET status = 'FINISHED', finished_at = NOW() WHERE id = $1",
    [sessionId]
  );

  const winners = getWinners(session.players);
  for (const [userId, { score }] of Object.entries(session.players)) {
    const isWinner = winners.includes(userId);
    const finalScore = score + (isWinner ? SCORE.GAME_WIN : 0);
    await db.query(
      `UPDATE users SET
        score_total = score_total + $1,
        games_total = games_total + 1,
        games_won   = games_won   + $2,
        games_lost  = games_lost  + $3,
        updated_at  = NOW()
       WHERE id = $4`,
      [finalScore, isWinner ? 1 : 0, isWinner ? 0 : 1, userId]
    );
    if (isWinner) {
      await updateLeaderboard(userId, SCORE.GAME_WIN, session.deckId);
    }
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

/**
 * Format a DB card row into full internal card object (stored in Redis).
 * Includes hiddenValue — only for server-side use!
 */
function formatFullCard(card) {
  return {
    cardId: card.id ?? card.cardId,
    title: card.title,
    subtitle: card.subtitle || null,
    imageUrl: card.image_url || card.imageUrl || null,
    hiddenValue: parseFloat(card.hidden_value ?? card.hiddenValue),
    displayValue: card.display_value || card.displayValue,
    flavorText: card.flavor_text || card.flavorText || null,
  };
}

/**
 * Remove hiddenValue/displayValue from face-down chain cards for client.
 */
function sanitizeChain(chain) {
  return chain.map((card) =>
    card.isFaceDown
      ? { ...card, hiddenValue: null, displayValue: '?' }
      : card
  );
}

/**
 * Get public info about players (hand count, score — no actual hand cards).
 */
function getPlayersInfo(players) {
  const info = {};
  for (const [uid, p] of Object.entries(players)) {
    info[uid] = {
      score: p.score,
      handCount: p.hand?.length ?? 0,
      turnOrder: p.turnOrder,
    };
  }
  return info;
}

class GameError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

export { GameError };
