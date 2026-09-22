import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { loadGuildRecord, saveGuildRecord } from "@management-bot/database";

export interface Warning {
  id: number;
  userId: string;
  moderatorId: string;
  reason: string;
  createdAt: string;
}
export interface Ticket {
  id: number;
  guildId: string;
  channelId: string;
  userId: string;
  status: "open" | "claimed" | "closed";
  claimedBy?: string;
  createdAt: string;
  closedAt?: string;
}
export interface Transcript {
  id: string;
  ticketId: number;
  channelId: string;
  content: string;
  createdAt: string;
}
export interface ExchangeRequest {
  id: string;
  guildId: string;
  userId: string;
  title: string;
  description: string;
  link?: string;
  status: "pending" | "approved" | "rejected";
  reason?: string;
  createdAt: string;
  reviewedBy?: string;
}
export interface Giveaway {
  id: number;
  guildId: string;
  channelId: string;
  messageId?: string;
  prize: string;
  winners: number;
  endsAt: string;
  entries: string[];
  ended: boolean;
}
export interface Poll {
  id: number;
  question: string;
  options: string[];
  votes: Record<string, number>;
  closed: boolean;
  createdAt: string;
}
export interface MemberStats {
  xp: number;
  level: number;
  messages: number;
  invites: number;
  balance: number;
  reputation?: number;
  lastDaily?: string;
}
export interface GuildData {
  warnings: Warning[];
  tickets: Ticket[];
  exchanges: ExchangeRequest[];
  giveaways: Giveaway[];
  polls: Poll[];
  transcripts: Transcript[];
  stats: Record<string, MemberStats>;
  config: {
    language: "en" | "fa";
    logChannelId?: string;
    welcomeChannelId?: string;
    welcomeMessage: string;
    ticketCategoryId?: string;
    exchangeChannelId?: string;
    staffRoleId?: string;
    modules?: Record<string, boolean>;
    leaveChannelId?: string;
    leaveMessage?: string;
    automod?: AutoModConfig;
  };
  audit: Array<{
    action: string;
    actorId?: string;
    targetId?: string;
    metadata?: unknown;
    createdAt: string;
  }>;
}
export interface AutoModConfig {
  enabled: boolean;
  inviteLinks: boolean;
  mentionSpam: boolean;
  duplicateMessages: boolean;
  capsSpam: boolean;
  badWords: string[];
  ignoredChannels: string[];
  ignoredRoles: string[];
  ignoredUsers: string[];
  action: 'delete' | 'timeout' | 'warn';
  timeoutSeconds: number;
}

const dataDir = process.env.DATA_DIR ?? join(process.cwd(), "data");
const filePath = join(dataDir, "guilds.json");
let cache: Record<string, GuildData> | null = null;
let writeQueue: Promise<void> = Promise.resolve();

function freshGuild(): GuildData {
  return {
    warnings: [],
    tickets: [],
    exchanges: [],
    giveaways: [],
    polls: [],
    transcripts: [],
    stats: {},
    config: {
      language: "en",
      welcomeMessage: "Welcome {{user}} to {{guild}}!",
      modules: {},
      automod: { enabled: true, inviteLinks: true, mentionSpam: true, duplicateMessages: true, capsSpam: true, badWords: [], ignoredChannels: [], ignoredRoles: [], ignoredUsers: [], action: 'timeout', timeoutSeconds: 60 },
    },
    audit: [],
  };
}

async function load(): Promise<Record<string, GuildData>> {
  if (cache) return cache;
  try {
    cache = JSON.parse(await readFile(filePath, "utf8")) as Record<
      string,
      GuildData
    >;
  } catch {
    cache = {};
  }
  return cache;
}

async function syncFromSupabase(
  guildId: string,
  value: GuildData,
): Promise<GuildData> {
  if (
    !process.env.SUPABASE_URL ||
    (!process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.SUPABASE_ANON_KEY)
  )
    return value;
  const remote = await loadGuildRecord(guildId);
  if (!remote) return value;
  return {
    ...value,
    ...remote,
    config: {
      ...value.config,
      ...(remote.config as Partial<GuildData["config"]> | undefined),
    },
  } as GuildData;
}

export async function guildData(guildId: string): Promise<GuildData> {
  const data = await load();
  data[guildId] ??= freshGuild();
  data[guildId] = await syncFromSupabase(guildId, data[guildId]);
  return data[guildId];
}

export async function save(): Promise<void> {
  const data = await load();
  writeQueue = writeQueue.then(async () => {
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, JSON.stringify(data, null, 2));
    if (
      process.env.SUPABASE_URL &&
      (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY)
    )
      for (const [guildId, guild] of Object.entries(data))
        await saveGuildRecord(
          guildId,
          guild as unknown as Record<string, unknown>,
        );
  });
  await writeQueue;
}

export async function saveGuild(
  guildId: string,
  guild: GuildData,
): Promise<void> {
  await save();
  if (
    process.env.SUPABASE_URL &&
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY)
  )
    await saveGuildRecord(guildId, guild as unknown as Record<string, unknown>);
}

export function statsFor(guild: GuildData, userId: string): MemberStats {
  guild.stats[userId] ??= {
    xp: 0,
    level: 0,
    messages: 0,
    invites: 0,
    balance: 0,
  };
  return guild.stats[userId];
}

export function addAudit(
  guild: GuildData,
  action: string,
  actorId?: string,
  targetId?: string,
  metadata?: unknown,
): void {
  guild.audit.unshift({
    action,
    actorId,
    targetId,
    metadata,
    createdAt: new Date().toISOString(),
  });
  guild.audit = guild.audit.slice(0, 1000);
}
