import { getAllDecks, getDeckCards } from '../../db/models/deck.js';

export async function deckRoutes(fastify) {
  fastify.get('/', async () => {
    return getAllDecks();
  });

  fastify.get('/:id/cards', async (request, reply) => {
    const cards = await getDeckCards(parseInt(request.params.id));
    if (!cards.length) return reply.code(404).send({ error: 'Deck not found or empty' });
    return cards.map((c) => ({
      id: c.id,
      title: c.title,
      subtitle: c.subtitle,
      imageUrl: c.image_url,
      // Don't expose hidden_value here — only shown on reveal
    }));
  });
}
