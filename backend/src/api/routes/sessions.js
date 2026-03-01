import { getSession } from '../../redis/session.js';
import { redisSub } from '../../redis/client.js';
import { createSession, processMove, processChallenge, joinSession, GameError } from '../../game/session.js';

export async function sessionRoutes(fastify) {
  // POST /api/sessions — create new game session
  fastify.post('/', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const userId = parseInt(request.user.sub);
    const { deckId } = request.body || {};

    if (!deckId) return reply.code(400).send({ error: 'deckId required' });

    try {
      const { sessionId, session } = await createSession({ userId, deckId });
      return { sessionId, session: sanitizeSession(session, String(userId)) };
    } catch (err) {
      return reply.code(400).send({ error: err.message });
    }
  });

  // POST /api/sessions/:id/join — join an existing game session
  fastify.post('/:id/join', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const userId = parseInt(request.user.sub);

    try {
      const { session } = await joinSession({ sessionId: request.params.id, userId });
      return { session: sanitizeSession(session, String(userId)) };
    } catch (err) {
      const status = err instanceof GameError ? err.statusCode : 500;
      return reply.code(status).send({ error: err.message });
    }
  });

  // GET /api/sessions/:id — get session state
  fastify.get('/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const session = await getSession(request.params.id);
    if (!session) return reply.code(404).send({ error: 'Session not found' });

    return sanitizeSession(session, request.user.sub);
  });

  // POST /api/sessions/:id/move — place card from hand into chain
  fastify.post('/:id/move', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const userId = parseInt(request.user.sub);
    const { cardId, position } = request.body || {};

    if (cardId === undefined || position === undefined) {
      return reply.code(400).send({ error: 'cardId and position required' });
    }

    try {
      const result = await processMove({
        sessionId: request.params.id,
        userId,
        cardId,
        position,
      });
      return {
        session: sanitizeSession(result.session, String(userId)),
        gameOver: result.gameOver,
        winners: result.winners,
      };
    } catch (err) {
      const status = err instanceof GameError ? err.statusCode : 500;
      return reply.code(status).send({ error: err.message });
    }
  });

  // POST /api/sessions/:id/challenge — challenge the chain ("Не верю!")
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
  fastify.get('/:id/stream', async (request, reply) => {
    const token = request.headers.authorization?.split(' ')[1] || request.query.token;
    if (!token) return reply.code(401).send({ error: 'Unauthorized' });
    try {
      request.user = fastify.jwt.verify(token);
    } catch {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

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
 * Remove sensitive data from session for client.
 * - Face-down chain cards: no hiddenValue
 * - Player's own hand: show cards but no hiddenValue/displayValue
 * - Other players' hands: show count only
 */
function sanitizeSession(session, userId) {
  const safe = { ...session };
  const uid = String(userId);

  // Sanitize chain — hide values of face-down cards
  safe.chain = session.chain.map((card) =>
    card.isFaceDown
      ? { ...card, hiddenValue: null, displayValue: '?' }
      : card
  );

  // Sanitize players — only show own hand cards (without hidden values)
  safe.players = {};
  for (const [pid, player] of Object.entries(session.players)) {
    if (pid === uid) {
      safe.players[pid] = {
        score: player.score,
        turnOrder: player.turnOrder,
        hand: (player.hand || []).map((c) => ({
          cardId: c.cardId,
          title: c.title,
          subtitle: c.subtitle,
          imageUrl: c.imageUrl,
          flavorText: c.flavorText,
        })),
        handCount: player.hand?.length ?? 0,
      };
    } else {
      safe.players[pid] = {
        score: player.score,
        turnOrder: player.turnOrder,
        handCount: player.hand?.length ?? 0,
      };
    }
  }

  // Remove internal fields
  delete safe.allCardIds;
  delete safe.usedCardIds;

  return safe;
}
