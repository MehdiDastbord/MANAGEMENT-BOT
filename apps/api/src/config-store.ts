import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { loadGuildRecord, saveGuildRecord } from '@management-bot/database';

export interface TicketPanel {
  id: string;
  name: string;
  emoji?: string;
  description?: string;
  kind: 'support' | 'exchange' | 'staff' | 'custom';
  enabled?: boolean;
}

export interface ApiGuildConfig {
  guildId: string;
  language: 'en' | 'fa';
  modules: Record<string, boolean>;
  channels: { logs?: string; welcome?: string; tickets?: string; exchange?: string; level?: string; invites?: string };
  logChannels?: Record<string, string>;
  messages: { welcome: string };
  leave?: { channelId?: string; message?: string };
  automod?: { enabled: boolean; inviteLinks: boolean; mentionSpam: boolean; capsSpam: boolean; badWords: string[]; action: 'delete' | 'timeout' | 'warn'; timeoutSeconds: number };
  rolePermissions?: Record<string, string[]>;
  ticketSettings?: { nameTemplate?: string; staffRoleId?: string; mentionRoleId?: string; transcriptChannelId?: string; ownerCanClose?: boolean };
  exchangeSettings?: { reviewChannelId?: string; publishChannelId?: string; reviewRoleId?: string };
  ticketPanels?: TicketPanel[];
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
  configs[guildId] ??= { guildId, language: 'en', modules: { moderation: true, tickets: true, exchange: true, xp: true, invites: true, welcome: true, giveaways: true, economy: true, automod: true, logs: true }, channels: {}, messages: { welcome: 'Welcome {{user}} to {{guild}}!' }, ticketPanels: [
    { id: 'support', name: 'Support', emoji: '🎫', description: 'Create a support ticket', kind: 'support', enabled: true },
    { id: 'exchange', name: 'Exchange', emoji: '🔄', description: 'Submit an exchange request', kind: 'exchange', enabled: true },
    { id: 'staff', name: 'Staff Apply', emoji: '🛡️', description: 'Apply for staff', kind: 'staff', enabled: true }
  ], updatedAt: new Date().toISOString(), warnings: [], tickets: [], exchanges: [], giveaways: [], stats: {}, audit: [], config: { language: 'en', welcomeMessage: 'Welcome {{user}} to {{guild}}!' } } as ApiGuildConfig;
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
  if (patch.logChannels) config.logChannels = { ...config.logChannels, ...patch.logChannels };
  if (patch.messages) config.messages = { ...config.messages, ...patch.messages };
  const incoming = patch as Partial<ApiGuildConfig>;
  if (incoming.leave) config.leave = { ...config.leave, ...incoming.leave };
  if (incoming.automod) config.automod = { ...config.automod, ...incoming.automod };
  if (incoming.rolePermissions) config.rolePermissions = { ...config.rolePermissions, ...incoming.rolePermissions };
  if (incoming.ticketSettings) config.ticketSettings = { ...config.ticketSettings, ...incoming.ticketSettings };
  if (incoming.exchangeSettings) config.exchangeSettings = { ...config.exchangeSettings, ...incoming.exchangeSettings };
  if (incoming.ticketPanels) config.ticketPanels = incoming.ticketPanels;
  const shared = config as ApiGuildConfig & { config?: Record<string, unknown> };
  shared.config = { ...shared.config, language: config.language, welcomeMessage: config.messages.welcome, logChannelId: config.channels.logs, welcomeChannelId: config.channels.welcome, ticketCategoryId: config.channels.tickets, exchangeChannelId: config.channels.exchange, modules: config.modules, leaveChannelId: config.leave?.channelId, leaveMessage: config.leave?.message, automod: config.automod, rolePermissions: config.rolePermissions, logChannels: config.logChannels, levelChannelId: config.channels.level, inviteChannelId: config.channels.invites, ticketNameTemplate: config.ticketSettings?.nameTemplate, ticketStaffRoleId: config.ticketSettings?.staffRoleId, ticketMentionRoleId: config.ticketSettings?.mentionRoleId, ticketTranscriptChannelId: config.ticketSettings?.transcriptChannelId, ticketOwnerCanClose: config.ticketSettings?.ownerCanClose, exchangeReviewChannelId: config.exchangeSettings?.reviewChannelId, exchangePublishChannelId: config.exchangeSettings?.publishChannelId, exchangeReviewRoleId: config.exchangeSettings?.reviewRoleId };
  config.updatedAt = new Date().toISOString();
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(await all(), null, 2));
  if (process.env.SUPABASE_URL && (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY)) await saveGuildRecord(guildId, config as unknown as Record<string, unknown>);
  return config;
}
