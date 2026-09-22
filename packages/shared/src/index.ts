export type SupportedLanguage = 'en' | 'fa';

export interface GuildConfig {
  guildId: string;
  language: SupportedLanguage;
  modulesEnabled: Record<string, boolean>;
  prefix: string;
  ownerId?: string;
}

export interface BotFeatureSummary {
  name: string;
  enabled: boolean;
  description: string;
}

export const FEATURE_SUMMARY: BotFeatureSummary[] = [
  { name: 'moderation', enabled: true, description: 'Ban, kick, warn, timeout and moderation logs' },
  { name: 'tickets', enabled: true, description: 'Support tickets with claims, close and transcripts' },
  { name: 'exchange', enabled: true, description: 'Reviewable exchange requests and approvals' },
  { name: 'xp', enabled: true, description: 'Leveling, leaderboard and XP rewards' },
  { name: 'invites', enabled: true, description: 'Invite tracking and milestone rewards' },
  { name: 'welcome', enabled: true, description: 'Welcome and leave automation' },
  { name: 'giveaways', enabled: true, description: 'Giveaway scheduler and entry tracking' },
  { name: 'economy', enabled: true, description: 'Currency, transactions and rewards' },
  { name: 'automod', enabled: true, description: 'Spam and abuse protections' },
  { name: 'logs', enabled: true, description: 'Audit and activity logging' },
  { name: 'roles', enabled: true, description: 'Role configuration and permissions' },
  { name: 'channels', enabled: true, description: 'Channel settings and management' },
  { name: 'dashboard', enabled: true, description: 'OAuth and dashboard access' }
];

export function createDefaultGuildConfig(guildId: string): GuildConfig {
  return {
    guildId,
    language: 'en',
    prefix: '!',
    modulesEnabled: Object.fromEntries(FEATURE_SUMMARY.map((feature) => [feature.name, feature.enabled]))
  };
}
