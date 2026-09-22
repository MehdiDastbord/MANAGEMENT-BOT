import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { configFor, updateConfig } from './config-store.js';

const app = Fastify({ logger: true });
await app.register(cors, { origin: process.env.DASHBOARD_ORIGIN?.split(',') ?? true });

app.addHook('onRequest', async (request, reply) => {
  const protectedPath = request.url.startsWith('/api/guilds/');
  const expected = process.env.API_KEY;
  if (protectedPath && expected && request.headers.authorization !== `Bearer ${expected}`) return reply.code(401).send({ error: 'Unauthorized' });
});

app.get('/health', async () => ({ status: 'ok', service: 'management-bot-api' }));

app.get('/api/features', async () => ({ features: Object.keys((await configFor('_defaults')).modules) }));

app.get<{ Params: { guildId: string } }>('/api/guilds/:guildId/config', async (request) => configFor(request.params.guildId));

app.put<{ Params: { guildId: string }; Body: Record<string, unknown> }>('/api/guilds/:guildId/config', async (request, reply) => {
  if (!request.body || typeof request.body !== 'object') return reply.code(400).send({ error: 'Configuration body must be an object.' });
  return updateConfig(request.params.guildId, request.body);
});

app.get<{ Params: { guildId: string } }>('/api/guilds/:guildId/overview', async (request) => ({
  guildId: request.params.guildId,
  status: 'connected',
  modules: (await configFor(request.params.guildId)).modules,
  metrics: { members: 0, messagesToday: 0, ticketsOpen: 0, exchangePending: 0 }
}));

const start = async () => {
  const port = Number(process.env.PORT || process.env.API_PORT || 3001);
  await app.listen({ port, host: '0.0.0.0' });
  console.log(`API listening on http://localhost:${port}`);
};

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
