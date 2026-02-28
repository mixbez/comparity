import {
  validateMove,
  resolveChallenge,
  insertCard,
  removeCard,
  revealCard,
  applyScore,
  isGameOver,
  getWinners,
  drawCard,
  SCORE,
} from './engine.js';

// Helper: make chain entry
const c = (hiddenValue, isFaceDown = false) => ({
  cardId: hiddenValue,
  title: `Card ${hiddenValue}`,
  hiddenValue,
  displayValue: String(hiddenValue),
  isFaceDown,
  placedBy: 1,
});

// ─── validateMove ──────────────────────────────────────────────────────────────

describe('validateMove', () => {
  const chain = [c(100), c(300), c(500)];

  test('valid: insert at start (smallest)', () => {
    expect(validateMove(chain, c(50), 0).valid).toBe(true);
  });

  test('valid: insert at end (largest)', () => {
    expect(validateMove(chain, c(600), 3).valid).toBe(true);
  });

  test('valid: insert in middle', () => {
    expect(validateMove(chain, c(200), 1).valid).toBe(true);
  });

  test('invalid: less than left neighbor', () => {
    const result = validateMove(chain, c(50), 2);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('less_than_left');
  });

  test('invalid: greater than right neighbor', () => {
    const result = validateMove(chain, c(400), 1);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('greater_than_right');
  });

  test('invalid: out of bounds position', () => {
    expect(validateMove(chain, c(200), -1).valid).toBe(false);
    expect(validateMove(chain, c(200), 10).valid).toBe(false);
  });

  test('skips face-down cards when finding neighbor', () => {
    // Face-down card at idx 1 should be skipped
    const chainWithBluff = [c(100), c(999, true), c(500)];
    // Placing 200 at position 1 — left revealed neighbor is 100, right revealed neighbor is 500
    expect(validateMove(chainWithBluff, c(200), 1).valid).toBe(true);
  });

  test('empty chain: any card valid at position 0', () => {
    expect(validateMove([], c(999), 0).valid).toBe(true);
  });
});

// ─── resolveChallenge ─────────────────────────────────────────────────────────

describe('resolveChallenge', () => {
  // Chain: [100, ???, 500] — bluff at position 1
  const chainWithBluff = [c(100), c(300, true), c(500)];
  const bluffCard = c(300); // actual value = 300 (correct position)
  const wrongCard = c(600); // actual value = 600 (wrong position)

  test('bluff held: correct placement survives challenge', () => {
    const result = resolveChallenge(chainWithBluff, 1, bluffCard, 'player1', 'challenger');
    expect(result.bluffCaught).toBe(false);
    expect(result.scoreDeltaPlacer).toBe(SCORE.BLUFF_HELD);
    expect(result.scoreDeltaChallenger).toBe(SCORE.CHALLENGE_LOSE);
    expect(result.newChain[1].isFaceDown).toBe(false); // revealed
  });

  test('bluff caught: wrong placement is removed', () => {
    const chainWrong = [c(100), c(600, true), c(500)];
    const result = resolveChallenge(chainWrong, 1, wrongCard, 'player1', 'challenger');
    expect(result.bluffCaught).toBe(true);
    expect(result.scoreDeltaPlacer).toBe(SCORE.BLUFF_CAUGHT);
    expect(result.scoreDeltaChallenger).toBe(SCORE.CHALLENGE_WIN);
    expect(result.newChain.length).toBe(2); // card removed
  });
});

// ─── insertCard ───────────────────────────────────────────────────────────────

describe('insertCard', () => {
  test('inserts card at given position', () => {
    const chain = [c(100), c(500)];
    const card = { id: 99, title: 'New', hidden_value: 300, display_value: '300', image_url: '' };
    const result = insertCard(chain, card, 1, false, 42);
    expect(result.length).toBe(3);
    expect(result[1].hiddenValue).toBe(300);
    expect(result[1].isFaceDown).toBe(false);
    expect(result[1].placedBy).toBe(42);
  });

  test('inserts face-down card (bluff)', () => {
    const chain = [];
    const card = { id: 1, title: 'Test', hidden_value: 100, display_value: '100', image_url: '' };
    const result = insertCard(chain, card, 0, true, 99);
    expect(result[0].isFaceDown).toBe(true);
  });
});

// ─── applyScore ───────────────────────────────────────────────────────────────

describe('applyScore', () => {
  test('adds score delta to player', () => {
    const players = { '1': { score: 5, turnOrder: 0 } };
    expect(applyScore(players, 1, 2)['1'].score).toBe(7);
    expect(applyScore(players, 1, -1)['1'].score).toBe(4);
  });

  test('initializes score to 0 if player missing', () => {
    const result = applyScore({}, '99', 3);
    expect(result['99'].score).toBe(3);
  });
});

// ─── isGameOver ───────────────────────────────────────────────────────────────

describe('isGameOver', () => {
  const chain10 = new Array(10).fill(c(1));
  test('game over when chain reaches max', () => {
    expect(isGameOver(chain10, 10, 5)).toBe(true);
  });
  test('game over when no cards remain', () => {
    expect(isGameOver([], 10, 0)).toBe(true);
  });
  test('game continues otherwise', () => {
    expect(isGameOver([c(1), c(2)], 10, 5)).toBe(false);
  });
});

// ─── getWinners ───────────────────────────────────────────────────────────────

describe('getWinners', () => {
  test('returns player with highest score', () => {
    const players = { '1': { score: 10 }, '2': { score: 15 }, '3': { score: 8 } };
    expect(getWinners(players)).toEqual(['2']);
  });
  test('returns multiple winners on tie', () => {
    const players = { '1': { score: 10 }, '2': { score: 10 } };
    expect(getWinners(players).sort()).toEqual(['1', '2']);
  });
});

// ─── drawCard ─────────────────────────────────────────────────────────────────

describe('drawCard', () => {
  const deck = [{ id: 1 }, { id: 2 }, { id: 3 }];
  test('does not return used cards', () => {
    const used = new Set([1, 2]);
    const card = drawCard(deck, used);
    expect(card.id).toBe(3);
  });
  test('returns null when all cards used', () => {
    expect(drawCard(deck, new Set([1, 2, 3]))).toBeNull();
  });
});
