import { create } from 'zustand';
import { api } from '../api/client.js';

export const useGameStore = create((set, get) => ({
  // Session state
  sessionId: null,
  session: null,
  status: 'idle', // idle | loading | playing | finished | error

  // UI state
  draggedCard: null,
  pendingPosition: null,
  lastResult: null, // { type: 'correct'|'incorrect'|'bluff_caught'|'bluff_held', delta }
  challengeTimeLeft: null,
  showBluffToggle: false,
  isBluffMode: false,

  // ── Actions ─────────────────────────────────────────────────────────

  loadSession: async (sessionId) => {
    set({ status: 'loading', sessionId });
    try {
      const session = await api.getSession(sessionId);
      set({ session, status: 'playing' });
    } catch (err) {
      set({ status: 'error' });
    }
  },

  /**
   * Update session from an SSE event or full session replacement.
   * If data looks like a full session (has 'id'), replace entirely.
   * Otherwise merge the event payload fields into the existing session.
   */
  updateSession: (data) => {
    set((s) => {
      // Full session replacement (STATE event or initial load)
      if ('id' in data && 'deckId' in data) {
        return {
          session: data,
          status: data.status === 'FINISHED' ? 'finished' : 'playing',
        };
      }

      // Partial event payload — merge into existing session
      const session = s.session;
      if (!session) return { session: data };

      const merged = {
        ...session,
        ...(data.chain !== undefined && { chain: data.chain }),
        ...(data.players !== undefined && { players: data.players }),
        // currentTurn: explicit null means no next card; undefined means keep current
        ...('currentTurn' in data && { currentTurn: data.currentTurn }),
        ...(data.gameOver && { status: 'FINISHED' }),
      };

      return {
        session: merged,
        status: data.gameOver ? 'finished' : (s.status === 'loading' ? 'playing' : s.status),
        ...(data.turnResult && {
          lastResult: {
            type: data.turnResult.status?.toLowerCase(),
            delta: data.turnResult.scoreDelta,
          },
        }),
      };
    });
  },

  setDraggedCard: (card) => set({ draggedCard: card, pendingPosition: null }),

  setPendingPosition: (position) => set({ pendingPosition: position }),

  toggleBluffMode: () => set((s) => ({ isBluffMode: !s.isBluffMode })),

  confirmMove: async () => {
    const { sessionId, session, pendingPosition, isBluffMode } = get();
    const card = session?.currentTurn?.card;
    if (!card || pendingPosition === null) return;

    set({ status: 'loading' });
    try {
      const result = await api.makeMove(sessionId, card.cardId, pendingPosition, isBluffMode);
      const resultType = isBluffMode ? 'bluff_placed' : result.turnStatus.toLowerCase();
      set({
        session: result.session,
        lastResult: { type: resultType, delta: result.scoreDelta },
        pendingPosition: null,
        isBluffMode: false,
        status: result.session.status === 'FINISHED' ? 'finished' : 'playing',
      });
    } catch (err) {
      set({ status: 'playing', lastResult: { type: 'error', message: err.message } });
    }
  },

  challenge: async () => {
    const { sessionId } = get();
    set({ status: 'loading' });
    try {
      const result = await api.challenge(sessionId);
      set({
        session: { ...get().session, chain: result.newChain, players: result.players },
        lastResult: {
          type: result.bluffCaught ? 'bluff_caught' : 'bluff_held',
          delta: result.bluffCaught ? 2 : -1,
        },
        status: 'playing',
      });
    } catch (err) {
      set({ status: 'playing' });
    }
  },

  clearResult: () => set({ lastResult: null }),

  setChallengeTimeLeft: (ms) => set({ challengeTimeLeft: ms }),
}));
