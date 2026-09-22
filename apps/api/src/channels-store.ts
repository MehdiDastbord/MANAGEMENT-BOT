export interface ManagedChannel { id: string; name: string; type: number; parentId?: string; position: number; rateLimitPerUser: number; }

function token(): string {
  if (!process.env.BOT_TOKEN) throw new Error('BOT_TOKEN is required for Discord channel management.');
  return process.env.BOT_TOKEN;
}
async function discord(path: string, init?: RequestInit): Promise<any> {
  const response = await fetch(`https://discord.com/api/v10${path}`, { ...init, headers: { Authorization: `Bot ${token()}`, 'Content-Type': 'application/json', ...(init?.headers ?? {}) } });
  if (!response.ok) throw new Error(`Discord rejected channel operation (${response.status}).`);
  return response.status === 204 ? null : response.json();
}
export async function listChannels(guildId: string): Promise<ManagedChannel[]> {
  const channels = await discord(`/guilds/${guildId}/channels`) as Array<{ id: string; name: string; type: number; parent_id?: string; position: number; rate_limit_per_user?: number }>;
  return channels.map(channel => ({ id: channel.id, name: channel.name, type: channel.type, parentId: channel.parent_id, position: channel.position, rateLimitPerUser: channel.rate_limit_per_user ?? 0 }));
}
export async function createChannel(guildId: string, payload: { name: string; type?: number; parentId?: string }): Promise<ManagedChannel> { return discord(`/guilds/${guildId}/channels`, { method: 'POST', body: JSON.stringify({ name: payload.name.trim().slice(0, 100), type: payload.type ?? 0, parent_id: payload.parentId }) }); }
export async function updateChannel(guildId: string, channelId: string, patch: { name?: string; parentId?: string; rateLimitPerUser?: number }): Promise<ManagedChannel> {
  const body = {
    ...(patch.name ? { name: patch.name.trim().slice(0, 100) } : {}),
    ...(patch.parentId ? { parent_id: patch.parentId } : {}),
    ...(typeof patch.rateLimitPerUser === 'number' ? { rate_limit_per_user: patch.rateLimitPerUser } : {})
  };
  return discord(`/channels/${channelId}`, { method: 'PATCH', body: JSON.stringify(body) });
}
export async function deleteChannel(channelId: string): Promise<void> { await discord(`/channels/${channelId}`, { method: 'DELETE' }); }