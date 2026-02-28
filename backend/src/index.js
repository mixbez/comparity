import 'dotenv/config';
import { createBot } from './bot/index.js';
import { createServer } from './api/index.js';
import { db } from './db/client.js';
import { redis } from './redis/client.js';

const PORT = process.env.PORT || 3000;

async function main() {
  // Verify connections
  await db.query('SELECT 1');
  console.log('[DB] PostgreSQL connected');

  await redis.ping();
  console.log('[Redis] Connected');

  // Start bot
  const bot = createBot();

  // Start API server
  const server = await createServer();

  if (process.env.NODE_ENV === 'production') {
    // Register webhook route before listen
    server.post('/webhook', (req, reply) => {
      bot.handleUpdate(req.body);
      reply.send({ ok: true });
    });
  }

  await server.listen({ port: PORT, host: '0.0.0.0' });
  console.log(`[API] Fastify running on port ${PORT}`);

  if (process.env.NODE_ENV === 'production') {
    await bot.telegram.setWebhook(`${process.env.BOT_WEBHOOK_URL}`);
    console.log('[Bot] Webhook set');
  } else {
    await bot.launch();
    console.log('[Bot] Long polling started');
  }

  const shutdown = async () => {
    await bot.stop();
    await server.close();
    await db.end();
    redis.disconnect();
    process.exit(0);
  };

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});
