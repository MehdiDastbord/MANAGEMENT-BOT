import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { loadGuildRecord, saveGuildRecord } from '@management-bot/database';

export interface ApiGuildConfig {
  guildId: string;
  language: 'en' | 'fa';
  modules: Record<string, boolean>;
  channels: { logs?: string; welcome?: string; tickets?: string; exchange?: string };
  messages: { welcome: string };
  leave?: { channelId?: string; message?: string };
  automod?: { enabled: boolean; inviteLinks: boolean; mentionSpam: boolean; capsSpam: boolean; badWords: string[]; action: 'delete' | 'timeout' | 'warn'; timeoutSeconds: number };
  updatedAt: string;
}

const path = join(process.env.DATA_DIR ?? join(process.cwd(), 'data'), 'guilds.json');
let cache: Record<string, ApiGuildConfig> | null = null;

async function all(): Promise<Record<string, ApiGuildConfig>> {
  if (cache) return cache;
  try { cache = JSON.parse(await readFile(path, 'utf8')) as Record<string, ApiGuildConfig>; }
  catch { cache = {}; }
  return cache;
}

export async function configFor(guildId: string): Promise<ApiGuildConfig> {
  const configs = await all();
  configs[guildId] ??= { guildId, language: 'en', modules: { moderation: true, tickets: true, exchange: true, xp: true, invites: true, welcome: true, giveaways: true, economy: true, automod: true, logs: true }, channels: {}, messages: { welcome: 'Welcome {{user}} to {{guild}}!' }, updatedAt: new Date().toISOString(), warnings: [], tickets: [], exchanges: [], giveaways: [], stats: {}, audit: [], config: { language: 'en', welcomeMessage: 'Welcome {{user}} to {{guild}}!' } } as ApiGuildConfig;
  if (process.env.SUPABASE_URL && (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY)) {
    const remote = await loadGuildRecord(guildId);
    if (remote) configs[guildId] = { ...configs[guildId], ...remote } as ApiGuildConfig;
  }
  return configs[guildId];
}

export async function updateConfig(guildId: string, patch: Partial<ApiGuildConfig>): Promise<ApiGuildConfig> {
  const config = await configFor(guildId);
  if (patch.language) config.language = patch.language;
  if (patch.modules) config.modules = { ...config.modules, ...patch.modules };
  if (patch.channels) config.channels = { ...config.channels, ...patch.channels };
  if (patch.messages) config.messages = { ...config.messages, ...patch.messages };
  const incoming = patch as Partial<ApiGuildConfig>;
  if (incoming.leave) config.leave = { ...config.leave, ...incoming.leave };
  if (incoming.automod) config.automod = { ...config.automod, ...incoming.automod };
  const shared = config as ApiGuildConfig & { config?: { language: 'en' | 'fa'; welcomeMessage: string; logChannelId?: string; welcomeChannelId?: string; ticketCategoryId?: string; exchangeChannelId?: string; modules?: Record<string, boolean> } };
  shared.config = { ...shared.config, language: config.language, welcomeMessage: config.messages.welcome, logChannelId: config.channels.logs, welcomeChannelId: config.channels.welcome, ticketCategoryId: config.channels.tickets, exchangeChannelId: config.channels.exchange, modules: config.modules };
  config.updatedAt = new Date().toISOString();
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(await all(), null, 2));
  if (process.env.SUPABASE_URL && (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY)) await saveGuildRecord(guildId, config as unknown as Record<string, unknown>);
  return config;
}
