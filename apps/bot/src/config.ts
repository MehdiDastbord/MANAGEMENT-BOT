import 'dotenv/config';
import { createDefaultGuildConfig, type GuildConfig } from '@management-bot/shared';

export const env = {
  botToken: process.env.BOT_TOKEN ?? '',
  clientId: process.env.CLIENT_ID ?? '',
  guildId: process.env.GUILD_ID ?? '',
  port: Number(process.env.API_PORT ?? 3001)
};

export function getGuildConfig(guildId: string): GuildConfig {
  return createDefaultGuildConfig(guildId);
}
