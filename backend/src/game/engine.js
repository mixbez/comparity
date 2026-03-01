/**
 * Comparity Game Engine — Pure Functions
 *
 * New rules (MVP Digital Adapt):
 * - Players get a hand of cards (hidden values unknown to them)
 * - One anchor card placed face-up on the table
 * - Players take turns placing cards face-down into the chain
 * - Next player can either place their card or challenge ("Не верю!")
 * - Challenge reveals entire chain; if order broken, last wrong player gets penalty
 * - Penalty = draw extra cards from deck
 * - Win = first to empty hand (or fewest cards when deck exhausted)
 *
 * Chain structure:
 *   chain = [ { cardId, title, hiddenValue, displayValue, isFaceDown, placedBy, turnNumber }, ... ]
 *   Should be ascending by hiddenValue (left = smallest, right = largest)
 *
 * Position: 0-indexed insertion index.
 *   chain = [A, B, C]  positions: 0=before A, 1=between A&B, 2=between B&C, 3=after C
 */

export const PENALTY_CARDS = 2;
export const DEFAULT_HAND_SIZE = 5;

export const SCORE = {
  CHALLENGE_WIN: 2,    // successfully caught invalid chain
  CHALLENGE_LOSE: -1,  // wrongly challenged valid chain
  PENALTY: -1,         // placed card that broke the chain
  GAME_WIN: 10,        // won the game
};

/**
 * Draw N random cards from available deck cards.
 * @param {Array<Object>} deckCards - all cards in deck (with .id)
 * @param {Set<number>} usedCardIds
 * @param {number} count
 * @returns {{ drawn: Array<Object>, newUsedIds: Set<number> }}
 */
export function drawCards(deckCards, usedCardIds, count) {
  const available = deckCards.filter((c) => !usedCardIds.has(c.id));
  const shuffled = [...available].sort(() => Math.random() - 0.5);
  const drawn = shuffled.slice(0, Math.min(count, shuffled.length));
  const newUsedIds = new Set(usedCardIds);
  drawn.forEach((c) => newUsedIds.add(c.id));
  return { drawn, newUsedIds };
}

/**
 * Draw a single random card. Returns card or null.
 * @param {Array<Object>} deckCards
 * @param {Set<number>} usedCardIds
 * @returns {Object|null}
 */
export function drawCard(deckCards, usedCardIds) {
  const available = deckCards.filter((c) => !usedCardIds.has(c.id));
  if (!available.length) return null;
  return available[Math.floor(Math.random() * available.length)];
}

/**
 * Insert a card into the chain at the given position.
 * Returns a new chain array (immutable).
 *
 * @param {Array} chain
 * @param {Object} card - must have hiddenValue/hidden_value, title, etc.
 * @param {number} position - insertion index (0 to chain.length)
 * @param {boolean} isFaceDown
 * @param {string|null} placedBy - userId
 * @param {number} turnNumber
 * @returns {Array}
 */
export function insertCard(chain, card, position, isFaceDown, placedBy, turnNumber) {
  const newEntry = {
    cardId: card.id ?? card.cardId,
    title: card.title,
    subtitle: card.subtitle || null,
    imageUrl: card.imageUrl || card.image_url || null,
    hiddenValue: parseFloat(card.hiddenValue ?? card.hidden_value),
    displayValue: card.displayValue ?? card.display_value,
    isFaceDown,
    placedBy: placedBy != null ? String(placedBy) : null,
    turnNumber: turnNumber ?? 0,
  };

  const newChain = [...chain];
  newChain.splice(position, 0, newEntry);
  return newChain;
}

/**
 * Remove card at position from chain. Returns new chain.
 */
export function removeCard(chain, position) {
  const newChain = [...chain];
  newChain.splice(position, 1);
  return newChain;
}

/**
 * Reveal all cards in the chain (flip face-up).
 * @param {Array} chain
 * @returns {Array}
 */
export function revealChain(chain) {
  return chain.map((card) => ({ ...card, isFaceDown: false }));
}

/**
 * Validate whether the entire chain is in ascending order by hiddenValue.
 * Returns validity info and identifies the player who made the last wrong move.
 *
 * @param {Array} chain - chain with all hiddenValues available
 * @returns {{ valid: boolean, invalidPositions: number[], lastWrongPlayer: string|null }}
 */
export function validateChain(chain) {
  if (chain.length <= 1) {
    return { valid: true, invalidPositions: [], lastWrongPlayer: null };
  }

  const invalidPositions = new Set();
  let lastWrongPlayer = null;
  let lastWrongTurnNumber = -1;

  for (let i = 1; i < chain.length; i++) {
    if (chain[i].hiddenValue < chain[i - 1].hiddenValue) {
      invalidPositions.add(i);
      invalidPositions.add(i - 1);

      // The more recently placed card in this pair is the culprit
      const a = chain[i - 1];
      const b = chain[i];
      const culprit = (b.turnNumber ?? 0) >= (a.turnNumber ?? 0) ? b : a;

      if ((culprit.turnNumber ?? 0) > lastWrongTurnNumber && culprit.placedBy != null) {
        lastWrongTurnNumber = culprit.turnNumber ?? 0;
        lastWrongPlayer = String(culprit.placedBy);
      }
    }
  }

  return {
    valid: invalidPositions.size === 0,
    invalidPositions: [...invalidPositions].sort((a, b) => a - b),
    lastWrongPlayer,
  };
}

/**
 * Resolve a challenge: reveal chain and determine who gets the penalty.
 *
 * @param {Array} chain - current chain (may contain face-down cards)
 * @param {string} challengerId - userId of the challenger
 * @returns {{
 *   chainValid: boolean,
 *   revealedChain: Array,
 *   penaltyPlayer: string|null,
 *   penaltyCards: number,
 *   invalidPositions: number[],
 *   reason: string,
 * }}
 */
export function resolveChallenge(chain, challengerId) {
  const revealed = revealChain(chain);
  const { valid, invalidPositions, lastWrongPlayer } = validateChain(revealed);

  if (valid) {
    return {
      chainValid: true,
      revealedChain: revealed,
      penaltyPlayer: String(challengerId),
      penaltyCards: PENALTY_CARDS,
      invalidPositions: [],
      reason: 'chain_valid',
    };
  }

  return {
    chainValid: false,
    revealedChain: revealed,
    penaltyPlayer: lastWrongPlayer,
    penaltyCards: PENALTY_CARDS,
    invalidPositions,
    reason: 'chain_invalid',
  };
}

/**
 * Apply a score delta to a player in the players map.
 * Returns updated players object (immutable).
 *
 * @param {Object} players - { [userId]: { score, ... } }
 * @param {string|number} userId
 * @param {number} delta
 * @returns {Object}
 */
export function applyScore(players, userId, delta) {
  const key = String(userId);
  return {
    ...players,
    [key]: {
      ...players[key],
      score: (players[key]?.score || 0) + delta,
    },
  };
}

/**
 * Check if game should end.
 * Game ends when any player has 0 cards in hand.
 *
 * @param {Object} players - { [userId]: { hand: [...], ... } }
 * @returns {boolean}
 */
export function isGameOver(players) {
  for (const [, player] of Object.entries(players)) {
    if (player.hand && player.hand.length === 0) return true;
  }
  return false;
}

/**
 * Determine winner(s) — players with fewest cards in hand.
 * @param {Object} players
 * @returns {Array<string>} array of userIds
 */
export function getWinners(players) {
  const entries = Object.entries(players);
  if (!entries.length) return [];
  const minCards = Math.min(...entries.map(([, p]) => p.hand?.length ?? Infinity));
  return entries
    .filter(([, p]) => (p.hand?.length ?? Infinity) === minCards)
    .map(([id]) => id);
}

/**
 * Get the next player index in turn order (wraps around).
 * @param {number} currentIndex
 * @param {number} playerCount
 * @returns {number}
 */
export function getNextPlayerIndex(currentIndex, playerCount) {
  return (currentIndex + 1) % playerCount;
}
