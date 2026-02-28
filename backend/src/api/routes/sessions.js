import { getSession } from '../../redis/session.js';
import { redisSub } from '../../redis/client.js';
import { createSession, processMove, processChallenge, GameError } from '../../game/session.js';
import { getAllDecks } from '../../db/models/deck.js';

export async function sessionRoutes(fastify) {
  // POST /api/sessions — create new game session
  fastify.post('/', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const userId = parseInt(request.user.sub);
    const { deckId } = request.body || {};

    if (!deckId) return reply.code(400).send({ error: 'deckId required' });

    try {
      const { sessionId, session } = await createSession({ userId, deckId });
      return { sessionId, session };
    } catch (err) {
      return reply.code(400).send({ error: err.message });
    }
  });

  // GET /api/sessions/:id — get session state
  fastify.get('/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const session = await getSession(request.params.id);
    if (!session) return reply.code(404).send({ error: 'Session not found' });

    // Don't expose hiddenValues of current turn card (the one being placed)
    const safeSession = sanitizeSession(session, request.user.sub);
    return safeSession;
  });

  // POST /api/sessions/:id/move — place card
  fastify.post('/:id/move', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const userId = parseInt(request.user.sub);
    const { cardId, position, isBluff = false } = request.body || {};

    if (cardId === undefined || position === undefined) {
      return reply.code(400).send({ error: 'cardId and position required' });
    }

    try {
      const result = await processMove({
        sessionId: request.params.id,
        userId,
        cardId,
        position,
        isBluff,
      });
      return result;
    } catch (err) {
      const status = err instanceof GameError ? err.statusCode : 500;
      return reply.code(status).send({ error: err.message });
    }
  });

  // POST /api/sessions/:id/challenge — challenge last bluff
  fastify.post('/:id/challenge', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const challengerId = parseInt(request.user.sub);

    try {
      const result = await processChallenge({
        sessionId: request.params.id,
        challengerId,
      });
      return result;
    } catch (err) {
      const status = err instanceof GameError ? err.statusCode : 500;
      return reply.code(status).send({ error: err.message });
    }
  });

  // GET /api/sessions/:id/stream — SSE for real-time updates
  fastify.get('/:id/stream', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const sessionId = request.params.id;

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const send = (data) => {
      reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // Send current state immediately
    const session = await getSession(sessionId);
    if (session) send({ type: 'STATE', payload: sanitizeSession(session, request.user.sub) });

    // Subscribe to updates
    const channel = `game:updates:${sessionId}`;
    const subscriber = redisSub.duplicate();
    await subscriber.subscribe(channel);

    subscriber.on('message', (_, message) => {
      send(JSON.parse(message));
    });

    // Heartbeat every 25s to keep connection alive
    const heartbeat = setInterval(() => {
      reply.raw.write(': ping\n\n');
    }, 25000);

    request.socket.on('close', () => {
      clearInterval(heartbeat);
      subscriber.unsubscribe(channel);
      subscriber.disconnect();
    });
  });
}

/**
 * Remove sensitive data (hiddenValues) from the session for the client.
 * Show the currentTurn card without its hiddenValue.
 */
function sanitizeSession(session, userId) {
  const safe = { ...session };

  // Mask hidden values of face-down chain cards
  safe.chain = session.chain.map((card) =>
    card.isFaceDown
      ? { ...card, hiddenValue: null, displayValue: '?' }
      : card
  );

  // Don't reveal hiddenValue of the card in hand
  if (safe.currentTurn?.card) {
    safe.currentTurn = {
      ...safe.currentTurn,
      card: {
        ...safe.currentTurn.card,
        hiddenValue: null, // client never needs to see this
      },
    };
  }

  return safe;
}
