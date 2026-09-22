import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  client ??= createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}

export async function loadGuildRecord(guildId: string): Promise<Record<string, unknown> | null> {
  const db = supabase();
  if (!db) return null;
  const { data, error } = await db.from('guild_settings').select('config').eq('guild_id', guildId).maybeSingle();
  if (error) throw error;
  return (data?.config as Record<string, unknown> | undefined) ?? null;
}

export async function saveGuildRecord(guildId: string, config: Record<string, unknown>): Promise<void> {
  const db = supabase();
  if (!db) return;
  const { error: guildError } = await db.from('guilds').upsert({ discord_id: guildId, name: String(config.guildName ?? guildId), language: config.language === 'fa' ? 'fa' : 'en', updated_at: new Date().toISOString() }, { onConflict: 'discord_id' });
  if (guildError) throw guildError;
  const { error } = await db.from('guild_settings').upsert({ guild_id: guildId, config, updated_at: new Date().toISOString() }, { onConflict: 'guild_id' });
  if (error) throw error;
}
