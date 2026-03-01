import { create } from 'zustand';
import { api } from '../api/client.js';

export const useGameStore = create((set, get) => ({
  // Session state
  sessionId: null,
  session: null,
  status: 'idle', // idle | loading | playing | finished | error

  // UI state
  selectedCardId: null,   // card selected from hand
  draggedCard: null,
  pendingPosition: null,
  lastResult: null,       // { type: 'card_placed'|'chain_valid'|'chain_invalid'|'error' }
  challengeResult: null,  // { chainValid, revealedChain, invalidPositions, penaltyPlayer }

  // ── Actions ─────────────────────────────────────────────────────────

  loadSession: async (sessionId) => {
    set({ status: 'loading', sessionId });
    try {
      const session = await api.getSession(sessionId);
      set({ session, status: session.status === 'FINISHED' ? 'finished' : 'playing' });
    } catch (err) {
      set({ status: 'error' });
    }
  },

  /**
   * Full session replacement from STATE SSE event.
   */
  updateSession: (data) => {
    set({
      session: data,
      status: data.status === 'FINISHED' ? 'finished' : 'playing',
    });
  },

  /**
   * Handle CHAIN_UPDATED SSE event.
   */
  handleChainUpdated: (payload) => {
    set((s) => {
      const session = s.session;
      if (!session) return {};

      return {
        session: {
          ...session,
          chain: payload.chain,
          currentPlayerIndex: payload.currentPlayerIndex,
          lastMoveBy: payload.lastMoveBy,
          players: mergePlayersInfo(session.players, payload.playersInfo),
          status: payload.gameOver ? 'FINISHED' : session.status,
        },
        status: payload.gameOver ? 'finished' : s.status,
        selectedCardId: null,
        pendingPosition: null,
      };
    });
  },

  /**
   * Handle CHALLENGE_RESULT SSE event — show revealed chain, then transition.
   */
  handleChallengeResult: (payload) => {
    set({
      challengeResult: {
        chainValid: payload.chainValid,
        revealedChain: payload.revealedChain,
        invalidPositions: payload.invalidPositions,
        penaltyPlayer: payload.penaltyPlayer,
        reason: payload.reason,
      },
    });

    // After showing revealed chain for 3 seconds, update to new state
    setTimeout(() => {
      set((s) => {
        const session = s.session;
        if (!session) return {};

        return {
          session: {
            ...session,
            chain: payload.newChain,
            currentPlayerIndex: payload.currentPlayerIndex,
            lastMoveBy: null,
            players: mergePlayersInfo(session.players, payload.playersInfo),
            status: payload.gameOver ? 'FINISHED' : session.status,
          },
          status: payload.gameOver ? 'finished' : s.status,
          challengeResult: null,
          selectedCardId: null,
          pendingPosition: null,
        };
      });
    }, 3000);
  },

  /**
   * Handle PLAYER_JOINED — reload session to get updated player list.
   */
  handlePlayerJoined: () => {
    const { sessionId } = get();
    if (sessionId) get().loadSession(sessionId);
  },

  selectCard: (cardId) => {
    const { selectedCardId } = get();
    // Toggle selection
    set({
      selectedCardId: selectedCardId === cardId ? null : cardId,
      pendingPosition: null,
    });
  },

  setDraggedCard: (card) => set({ draggedCard: card, pendingPosition: null }),

  setPendingPosition: (position) => set({ pendingPosition: position }),

  confirmMove: async () => {
    const { sessionId, selectedCardId, pendingPosition } = get();
    if (!selectedCardId || pendingPosition === null) return;

    set({ status: 'loading' });
    try {
      const result = await api.makeMove(sessionId, selectedCardId, pendingPosition);
      set({
        session: result.session,
        lastResult: { type: 'card_placed' },
        pendingPosition: null,
        selectedCardId: null,
        draggedCard: null,
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
      await api.challenge(sessionId);
      // SSE CHALLENGE_RESULT event will handle the UI update
      set({ status: 'playing' });
    } catch (err) {
      set({ status: 'playing', lastResult: { type: 'error', message: err.message } });
    }
  },

  clearResult: () => set({ lastResult: null }),
  clearChallengeResult: () => set({ challengeResult: null }),
}));

/**
 * Merge server playersInfo (handCount, score) into current players state.
 * Preserves hand cards for own player.
 */
function mergePlayersInfo(currentPlayers, playersInfo) {
  if (!playersInfo) return currentPlayers;
  const merged = { ...currentPlayers };
  for (const [uid, info] of Object.entries(playersInfo)) {
    merged[uid] = {
      ...merged[uid],
      score: info.score,
      handCount: info.handCount,
    };
  }
  return merged;
}
