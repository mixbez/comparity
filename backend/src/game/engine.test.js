import {
  drawCards,
  drawCard,
  insertCard,
  removeCard,
  revealChain,
  validateChain,
  resolveChallenge,
  applyScore,
  isGameOver,
  getWinners,
  getNextPlayerIndex,
  SCORE,
  PENALTY_CARDS,
} from './engine.js';

// Helper: make chain entry
const c = (hiddenValue, { isFaceDown = false, placedBy = null, turnNumber = 0 } = {}) => ({
  cardId: hiddenValue,
  title: `Card ${hiddenValue}`,
  hiddenValue,
  displayValue: String(hiddenValue),
  isFaceDown,
  placedBy: placedBy != null ? String(placedBy) : null,
  turnNumber,
});

// ─── drawCards ────────────────────────────────────────────────────────────────

describe('drawCards', () => {
  const deck = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }];

  test('draws requested number of cards', () => {
    const { drawn, newUsedIds } = drawCards(deck, new Set(), 3);
    expect(drawn.length).toBe(3);
    expect(newUsedIds.size).toBe(3);
  });

  test('does not draw already-used cards', () => {
    const { drawn } = drawCards(deck, new Set([1, 2, 3]), 2);
    expect(drawn.length).toBe(2);
    drawn.forEach((c) => expect([4, 5]).toContain(c.id));
  });

  test('draws fewer if not enough available', () => {
    const { drawn } = drawCards(deck, new Set([1, 2, 3, 4]), 3);
    expect(drawn.length).toBe(1);
    expect(drawn[0].id).toBe(5);
  });

  test('returns empty if all used', () => {
    const { drawn } = drawCards(deck, new Set([1, 2, 3, 4, 5]), 3);
    expect(drawn.length).toBe(0);
  });
});

// ─── drawCard ─────────────────────────────────────────────────────────────────

describe('drawCard', () => {
  const deck = [{ id: 1 }, { id: 2 }, { id: 3 }];

  test('does not return used cards', () => {
    const card = drawCard(deck, new Set([1, 2]));
    expect(card.id).toBe(3);
  });

  test('returns null when all cards used', () => {
    expect(drawCard(deck, new Set([1, 2, 3]))).toBeNull();
  });
});

// ─── insertCard ───────────────────────────────────────────────────────────────

describe('insertCard', () => {
  test('inserts card at given position face-down', () => {
    const chain = [c(100), c(500)];
    const card = { id: 99, title: 'New', hidden_value: 300, display_value: '300' };
    const result = insertCard(chain, card, 1, true, '42', 5);
    expect(result.length).toBe(3);
    expect(result[1].hiddenValue).toBe(300);
    expect(result[1].isFaceDown).toBe(true);
    expect(result[1].placedBy).toBe('42');
    expect(result[1].turnNumber).toBe(5);
  });

  test('inserts anchor card face-up', () => {
    const card = { id: 1, title: 'Anchor', hidden_value: 100, display_value: '100' };
    const result = insertCard([], card, 0, false, null, 0);
    expect(result[0].isFaceDown).toBe(false);
    expect(result[0].placedBy).toBeNull();
  });
});

// ─── removeCard ───────────────────────────────────────────────────────────────

describe('removeCard', () => {
  test('removes card at position', () => {
    const chain = [c(100), c(200), c(300)];
    const result = removeCard(chain, 1);
    expect(result.length).toBe(2);
    expect(result[0].hiddenValue).toBe(100);
    expect(result[1].hiddenValue).toBe(300);
  });
});

// ─── revealChain ──────────────────────────────────────────────────────────────

describe('revealChain', () => {
  test('sets all cards to face-up', () => {
    const chain = [
      c(100),
      c(200, { isFaceDown: true }),
      c(300, { isFaceDown: true }),
    ];
    const revealed = revealChain(chain);
    revealed.forEach((card) => expect(card.isFaceDown).toBe(false));
  });

  test('does not mutate original chain', () => {
    const chain = [c(100, { isFaceDown: true })];
    revealChain(chain);
    expect(chain[0].isFaceDown).toBe(true);
  });
});

// ─── validateChain ────────────────────────────────────────────────────────────

describe('validateChain', () => {
  test('valid: ascending order', () => {
    const chain = [c(100), c(200), c(300), c(400)];
    const result = validateChain(chain);
    expect(result.valid).toBe(true);
    expect(result.invalidPositions).toEqual([]);
    expect(result.lastWrongPlayer).toBeNull();
  });

  test('valid: single card', () => {
    const result = validateChain([c(100)]);
    expect(result.valid).toBe(true);
  });

  test('valid: empty chain', () => {
    const result = validateChain([]);
    expect(result.valid).toBe(true);
  });

  test('valid: equal values are OK', () => {
    const chain = [c(100), c(100), c(200)];
    expect(validateChain(chain).valid).toBe(true);
  });

  test('invalid: one card out of order', () => {
    // Anchor=100, player1 placed 500 (turn 1), player2 placed 200 after 500 (turn 2)
    const chain = [
      c(100, { placedBy: null, turnNumber: 0 }),
      c(500, { placedBy: '1', turnNumber: 1 }),
      c(200, { placedBy: '2', turnNumber: 2 }),
    ];
    const result = validateChain(chain);
    expect(result.valid).toBe(false);
    expect(result.invalidPositions).toContain(1);
    expect(result.invalidPositions).toContain(2);
    // Player 2 placed card most recently in the violating pair
    expect(result.lastWrongPlayer).toBe('2');
  });

  test('invalid: earlier player is culprit when they placed later', () => {
    // Anchor=100, player2 placed 200 (turn 1), player1 placed 50 before 200 (turn 2)
    const chain = [
      c(100, { placedBy: null, turnNumber: 0 }),
      c(50, { placedBy: '1', turnNumber: 2 }),
      c(200, { placedBy: '2', turnNumber: 1 }),
    ];
    const result = validateChain(chain);
    expect(result.valid).toBe(false);
    // Pair [100, 50] violates. 50 has turnNumber 2 > 0 → culprit is player 1
    expect(result.lastWrongPlayer).toBe('1');
  });

  test('invalid: multiple violations, finds last wrong player', () => {
    const chain = [
      c(100, { placedBy: null, turnNumber: 0 }),
      c(500, { placedBy: '1', turnNumber: 1 }),
      c(200, { placedBy: '2', turnNumber: 2 }),
      c(50, { placedBy: '3', turnNumber: 3 }),
    ];
    const result = validateChain(chain);
    expect(result.valid).toBe(false);
    // Violations: [500,200] → culprit turn2=player2; [200,50] → culprit turn3=player3
    // Player 3 has highest turnNumber
    expect(result.lastWrongPlayer).toBe('3');
  });
});

// ─── resolveChallenge ─────────────────────────────────────────────────────────

describe('resolveChallenge', () => {
  test('chain valid: challenger gets penalty', () => {
    const chain = [
      c(100, { placedBy: null, turnNumber: 0 }),
      c(200, { isFaceDown: true, placedBy: '1', turnNumber: 1 }),
      c(300, { isFaceDown: true, placedBy: '2', turnNumber: 2 }),
    ];
    const result = resolveChallenge(chain, 'challenger');
    expect(result.chainValid).toBe(true);
    expect(result.penaltyPlayer).toBe('challenger');
    expect(result.penaltyCards).toBe(PENALTY_CARDS);
    expect(result.invalidPositions).toEqual([]);
    // All cards should be revealed
    result.revealedChain.forEach((card) => expect(card.isFaceDown).toBe(false));
  });

  test('chain invalid: last wrong player gets penalty', () => {
    const chain = [
      c(100, { placedBy: null, turnNumber: 0 }),
      c(500, { isFaceDown: true, placedBy: '1', turnNumber: 1 }),
      c(200, { isFaceDown: true, placedBy: '2', turnNumber: 2 }),
    ];
    const result = resolveChallenge(chain, 'challenger');
    expect(result.chainValid).toBe(false);
    expect(result.penaltyPlayer).toBe('2');
    expect(result.penaltyCards).toBe(PENALTY_CARDS);
    expect(result.invalidPositions.length).toBeGreaterThan(0);
    result.revealedChain.forEach((card) => expect(card.isFaceDown).toBe(false));
  });
});

// ─── applyScore ───────────────────────────────────────────────────────────────

describe('applyScore', () => {
  test('adds score delta to player', () => {
    const players = { '1': { score: 5, turnOrder: 0, hand: [] } };
    expect(applyScore(players, 1, 2)['1'].score).toBe(7);
    expect(applyScore(players, 1, -1)['1'].score).toBe(4);
  });

  test('initializes score to 0 if player missing score', () => {
    const result = applyScore({}, '99', 3);
    expect(result['99'].score).toBe(3);
  });
});

// ─── isGameOver ───────────────────────────────────────────────────────────────

describe('isGameOver', () => {
  test('game over when a player has 0 cards', () => {
    const players = {
      '1': { hand: [], score: 0 },
      '2': { hand: [{ cardId: 1 }], score: 0 },
    };
    expect(isGameOver(players)).toBe(true);
  });

  test('game continues when all players have cards', () => {
    const players = {
      '1': { hand: [{ cardId: 1 }], score: 0 },
      '2': { hand: [{ cardId: 2 }], score: 0 },
    };
    expect(isGameOver(players)).toBe(false);
  });
});

// ─── getWinners ───────────────────────────────────────────────────────────────

describe('getWinners', () => {
  test('returns player with fewest cards', () => {
    const players = {
      '1': { hand: [{ cardId: 1 }], score: 0 },
      '2': { hand: [], score: 0 },
      '3': { hand: [{ cardId: 2 }, { cardId: 3 }], score: 0 },
    };
    expect(getWinners(players)).toEqual(['2']);
  });

  test('returns multiple winners on tie', () => {
    const players = {
      '1': { hand: [{ cardId: 1 }], score: 0 },
      '2': { hand: [{ cardId: 2 }], score: 0 },
    };
    expect(getWinners(players).sort()).toEqual(['1', '2']);
  });

  test('returns player with 0 cards as winner', () => {
    const players = {
      '1': { hand: [], score: 5 },
    };
    expect(getWinners(players)).toEqual(['1']);
  });
});

// ─── getNextPlayerIndex ───────────────────────────────────────────────────────

describe('getNextPlayerIndex', () => {
  test('advances to next player', () => {
    expect(getNextPlayerIndex(0, 3)).toBe(1);
    expect(getNextPlayerIndex(1, 3)).toBe(2);
  });

  test('wraps around to first player', () => {
    expect(getNextPlayerIndex(2, 3)).toBe(0);
  });

  test('stays on same player in single-player', () => {
    expect(getNextPlayerIndex(0, 1)).toBe(0);
  });
});
