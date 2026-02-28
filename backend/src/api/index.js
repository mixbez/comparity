import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { authRoutes } from './routes/auth.js';
import { sessionRoutes } from './routes/sessions.js';
import { deckRoutes } from './routes/decks.js';
import { leaderboardRoutes } from './routes/leaderboard.js';

export async function createServer() {
  const fastify = Fastify({ logger: process.env.NODE_ENV !== 'production' });

  await fastify.register(cors, {
    origin: [process.env.MINI_APP_URL, 'https://web.telegram.org'],
    credentials: true,
  });

  await fastify.register(jwt, {
    secret: process.env.JWT_SECRET || 'dev_secret_change_me',
    sign: { expiresIn: '7d' },
  });

  // Auth decorator
  fastify.decorate('authenticate', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.code(401).send({ error: 'Unauthorized' });
    }
  });

  // Health check
  fastify.get('/health', () => ({ ok: true, ts: Date.now() }));

  // Routes
  await fastify.register(authRoutes, { prefix: '/api/auth' });
  await fastify.register(sessionRoutes, { prefix: '/api/sessions' });
  await fastify.register(deckRoutes, { prefix: '/api/decks' });
  await fastify.register(leaderboardRoutes, { prefix: '/api/leaderboard' });

  return fastify;
}
