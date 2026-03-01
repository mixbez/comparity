/**
 * Comparity Game Engine — Pure Functions
 * All functions are side-effect free and easily testable.
 *
 * Chain structure:
 *   chain = [ { cardId, title, hiddenValue, displayValue, isFaceDown, placedBy }, ... ]
 *   Sorted ascending by hiddenValue (left = smallest, right = largest)
 *
 * Position: 0-indexed insertion index.
 *   chain = [A, B, C]  positions: 0=before A, 1=between A&B, 2=between B&C, 3=after C
 */

export const SCORE = {
  CORRECT_MOVE: 1,
  BLUFF_HELD: 2,         // bluff survived challenge
  BLUFF_CAUGHT: -1,      // placer loses when bluff is caught
  CHALLENGE_WIN: 2,      // challenger wins
  CHALLENGE_LOSE: -1,    // challenger loses when bluff held
};

/**
 * Validate whether placing `card` at `position` is correct given `chain`.
 * Ignores face-down cards (they don't constrain neighbors).
 *
 * @param {Array} chain - current chain (all cards including face-down)
 * @param {{ hiddenValue: number }} card - card being placed
 * @param {number} position - insertion index (0 to chain.length)
 * @returns {{ valid: boolean, reason?: string }}
 */
export function validateMove(chain, card, position) {
  if (position < 0 || position > chain.length) {
    return { valid: false, reason: 'position_out_of_bounds' };
  }

  const leftCard = findRevealedNeighbor(chain, position - 1, -1);
  const rightCard = findRevealedNeighbor(chain, position, 1);

  if (leftCard && card.hiddenValue < leftCard.hiddenValue) {
    return { valid: false, reason: 'less_than_left' };
  }
  if (rightCard && card.hiddenValue > rightCard.hiddenValue) {
    return { valid: false, reason: 'greater_than_right' };
  }

  return { valid: true };
}

/**
 * Find the nearest revealed (non-face-down) card in a direction.
 * @param {Array} chain
 * @param {number} startIdx - inclusive start
 * @param {number} direction - -1 (left) or +1 (right)
 * @returns {Object|null}
 */
function findRevealedNeighbor(chain, startIdx, direction) {
  let i = startIdx;
  while (i >= 0 && i < chain.length) {
    if (!chain[i].isFaceDown) return chain[i];
    i += direction;
  }
  return null;
}

/**
 * Insert a card into the chain at the given position.
 * Returns a new chain array (immutable).
 *
 * @param {Array} chain
 * @param {Object} card
 * @param {number} position
 * @param {boolean} isFaceDown
 * @param {number|string} placedBy - userId
 * @returns {Array}
 */
export function insertCard(chain, card, position, isFaceDown, placedBy) {
  const newEntry = {
    cardId: card.id ?? card.cardId,
    title: card.title,
    subtitle: card.subtitle || null,
    imageUrl: card.imageUrl || card.image_url,
    hiddenValue: parseFloat(card.hiddenValue ?? card.hidden_value),
    displayValue: card.displayValue ?? card.display_value,
    isFaceDown,
    placedBy,
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
 * Reveal a face-down card at position (challenge was won / bluff held).
 * Returns new chain.
 */
export function revealCard(chain, position) {
  return chain.map((card, i) =>
    i === position ? { ...card, isFaceDown: false } : card
  );
}

/**
 * Resolve a challenge against the last placed bluff card.
 *
 * @param {Array} chain - current chain
 * @param {number} position - position of challenged card in chain
 * @param {Object} card - the face-down card being challenged (with hiddenValue)
 * @param {number|string} placerId - userId of person who placed card
 * @param {number|string} challengerId - userId of challenger
 * @returns {{
 *   bluffCaught: boolean,
 *   newChain: Array,
 *   scoreDeltaPlacer: number,
 *   scoreDeltaChallenger: number,
 *   reason: string,
 * }}
 */
export function resolveChallenge(chain, position, card, placerId, challengerId) {
  const { valid } = validateMove(
    // Temporarily remove the challenged card from chain for validation
    removeCard(chain, position),
    card,
    position
  );

  if (valid) {
    // Bluff held — placer wins
    return {
      bluffCaught: false,
      newChain: revealCard(chain, position),
      scoreDeltaPlacer: SCORE.BLUFF_HELD,
      scoreDeltaChallenger: SCORE.CHALLENGE_LOSE,
      reason: 'bluff_held',
    };
  } else {
    // Bluff caught — challenger wins, card removed
    return {
      bluffCaught: true,
      newChain: removeCard(chain, position),
      scoreDeltaPlacer: SCORE.BLUFF_CAUGHT,
      scoreDeltaChallenger: SCORE.CHALLENGE_WIN,
      reason: 'bluff_caught',
    };
  }
}

/**
 * Apply a score delta to a player in the session players map.
 * Returns updated players object (immutable).
 *
 * @param {Object} players - { [userId]: { score, turnOrder } }
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
 * Check if game should end (chain reached max length or deck is exhausted).
 *
 * @param {Array} chain
 * @param {number} maxChainLength
 * @param {number} remainingCards - cards left in deck for this session
 * @returns {boolean}
 */
export function isGameOver(chain, maxChainLength, remainingCards) {
  return chain.length >= maxChainLength || remainingCards <= 0;
}

/**
 * Determine winner(s) from the players object.
 * @param {Object} players
 * @returns {Array<string>} array of userIds with highest score
 */
export function getWinners(players) {
  const entries = Object.entries(players);
  if (!entries.length) return [];
  const maxScore = Math.max(...entries.map(([, p]) => p.score));
  return entries.filter(([, p]) => p.score === maxScore).map(([id]) => id);
}

/**
 * Select a random card from a deck, excluding already-used card IDs.
 * @param {Array<Object>} deckCards - all cards in deck
 * @param {Set<number>} usedCardIds
 * @returns {Object|null}
 */
export function drawCard(deckCards, usedCardIds) {
  const available = deckCards.filter((c) => !usedCardIds.has(c.id));
  if (!available.length) return null;
  return available[Math.floor(Math.random() * available.length)];
}
