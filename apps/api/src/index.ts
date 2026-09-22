import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { configFor, updateConfig } from './config-store.js';
import { createFeature, deleteFeature, exportGuild, featureNames, importGuild, listFeature, updateFeature } from './features-store.js';

const app = Fastify({ logger: true });
const allowedOrigins = (process.env.DASHBOARD_ORIGIN ?? '')
  .split(',')
  .map((origin) => origin.trim().replace(/\/$/, ''))
  .filter(Boolean);
await app.register(cors, {
  origin: allowedOrigins.length > 0 ? allowedOrigins : true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});

app.addHook('onRequest', async (request, reply) => {
  if (request.method === 'OPTIONS') return;
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

app.get('/api/catalog', async () => ({ features: featureNames }));

app.get<{ Params: { guildId: string; feature: string } }>('/api/guilds/:guildId/:feature', async (request, reply) => {
  try { return await listFeature(request.params.guildId, request.params.feature); }
  catch (error) { return reply.code(400).send({ error: error instanceof Error ? error.message : 'Invalid feature.' }); }
});

app.post<{ Params: { guildId: string; feature: string }; Body: Record<string, unknown> }>('/api/guilds/:guildId/:feature', async (request, reply) => {
  try { return reply.code(201).send(await createFeature(request.params.guildId, request.params.feature, request.body ?? {})); }
  catch (error) { return reply.code(400).send({ error: error instanceof Error ? error.message : 'Invalid feature.' }); }
});

app.patch<{ Params: { guildId: string; feature: string; id: string }; Body: Record<string, unknown> }>('/api/guilds/:guildId/:feature/:id', async (request, reply) => {
  try { const result = await updateFeature(request.params.guildId, request.params.feature, request.params.id, request.body ?? {}); return result ? result : reply.code(404).send({ error: 'Record not found.' }); }
  catch (error) { return reply.code(400).send({ error: error instanceof Error ? error.message : 'Invalid feature.' }); }
});

app.delete<{ Params: { guildId: string; feature: string; id: string } }>('/api/guilds/:guildId/:feature/:id', async (request, reply) => {
  try { return (await deleteFeature(request.params.guildId, request.params.feature, request.params.id)) ? { deleted: true } : reply.code(404).send({ error: 'Record not found.' }); }
  catch (error) { return reply.code(400).send({ error: error instanceof Error ? error.message : 'Invalid feature.' }); }
});

app.get<{ Params: { guildId: string } }>('/api/guilds/:guildId/export', async (request) => exportGuild(request.params.guildId));
app.put<{ Params: { guildId: string }; Body: Record<string, unknown> }>('/api/guilds/:guildId/import', async (request) => importGuild(request.params.guildId, request.body));

const start = async () => {
  const port = Number(process.env.PORT || process.env.API_PORT || 3001);
  await app.listen({ port, host: '0.0.0.0' });
  console.log(`API listening on http://localhost:${port}`);
};

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
