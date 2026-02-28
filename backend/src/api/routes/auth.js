import crypto from 'crypto';
import { upsertUser } from '../../db/models/user.js';

/**
 * Verify Telegram WebApp initData HMAC-SHA256 signature.
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
function verifyTelegramInitData(initData, botToken) {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  params.delete('hash');

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest();

  const expectedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  if (expectedHash !== hash) return null;

  // Check auth_date is not too old (10 minutes)
  const authDate = parseInt(params.get('auth_date') || '0');
  if (Date.now() / 1000 - authDate > 600) return null;

  const userJson = params.get('user');
  return userJson ? JSON.parse(userJson) : null;
}

export async function authRoutes(fastify) {
  fastify.post('/', async (request, reply) => {
    const { initData } = request.body || {};
    if (!initData) {
      return reply.code(400).send({ error: 'initData required' });
    }

    const telegramUser = verifyTelegramInitData(initData, process.env.BOT_TOKEN);
    if (!telegramUser) {
      return reply.code(401).send({ error: 'Invalid initData' });
    }

    await upsertUser({
      id: telegramUser.id,
      username: telegramUser.username || null,
      firstName: telegramUser.first_name,
      lastName: telegramUser.last_name || null,
    });

    const token = fastify.jwt.sign({
      sub: String(telegramUser.id),
      firstName: telegramUser.first_name,
      username: telegramUser.username || null,
    });

    return { token, user: telegramUser };
  });
}
