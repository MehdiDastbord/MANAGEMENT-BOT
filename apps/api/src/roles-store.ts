import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export type PermissionAction =
  | 'moderation.ban' | 'moderation.kick' | 'moderation.timeout'
  | 'tickets.manage' | 'exchange.review' | 'exchange.approve'
  | 'dashboard.access' | 'automod.configure';

export const permissionActions: PermissionAction[] = [
  'moderation.ban', 'moderation.kick', 'moderation.timeout', 'tickets.manage',
  'exchange.review', 'exchange.approve', 'dashboard.access', 'automod.configure'
];

export interface ManagedRole {
  id: string;
  name: string;
  color: string;
  position: number;
  managed: boolean;
  hoist: boolean;
  mentionable: boolean;
  permissions: PermissionAction[];
}

const path = join(process.env.DATA_DIR ?? join(process.cwd(), 'data'), 'roles.json');
let cache: Record<string, ManagedRole[]> | null = null;

async function all(): Promise<Record<string, ManagedRole[]>> {
  if (cache) return cache;
  try { cache = JSON.parse(await readFile(path, 'utf8')) as Record<string, ManagedRole[]>; }
  catch { cache = {}; }
  return cache;
}

async function persist(): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(await all(), null, 2));
}

async function discordRoles(guildId: string): Promise<ManagedRole[] | null> {
  const token = process.env.BOT_TOKEN;
  if (!token) return null;
  const response = await fetch(`https://discord.com/api/v10/guilds/${guildId}/roles`, { headers: { Authorization: `Bot ${token}` } });
  if (!response.ok) return null;
  const roles = await response.json() as Array<{ id: string; name: string; color: number; position: number; managed: boolean; hoist: boolean; mentionable: boolean }>;
  const stored = (await all())[guildId] ?? [];
  return roles.sort((left, right) => right.position - left.position).map(role => ({
    id: role.id,
    name: role.name,
    color: role.color ? `#${role.color.toString(16).padStart(6, '0')}` : '#99aab5',
    position: role.position,
    managed: role.managed,
    hoist: role.hoist,
    mentionable: role.mentionable,
    permissions: stored.find(item => item.id === role.id)?.permissions ?? []
  }));
}

export async function listRoles(guildId: string): Promise<ManagedRole[]> {
  const remote = await discordRoles(guildId).catch(() => null);
  if (remote) {
    (await all())[guildId] = remote;
    await persist();
    return remote;
  }
  return (await all())[guildId] ?? [];
}

export async function updateRole(guildId: string, roleId: string, patch: Partial<ManagedRole>): Promise<ManagedRole | null> {
  const roles = await listRoles(guildId);
  const role = roles.find(item => item.id === roleId);
  if (!role) return null;
  role.permissions = Array.isArray(patch.permissions)
    ? patch.permissions.filter((action): action is PermissionAction => permissionActions.includes(action as PermissionAction))
    : role.permissions;
  if (patch.name && !role.managed) role.name = patch.name.trim().slice(0, 100);
  if (patch.color && /^#[0-9a-f]{6}$/i.test(patch.color)) role.color = patch.color;
  if (typeof patch.hoist === 'boolean' && !role.managed) role.hoist = patch.hoist;
  if (typeof patch.mentionable === 'boolean' && !role.managed) role.mentionable = patch.mentionable;
  const token = process.env.BOT_TOKEN;
  if (token && !role.managed && (patch.name || patch.color)) {
    const response = await fetch(`https://discord.com/api/v10/guilds/${guildId}/roles/${roleId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...(patch.name ? { name: role.name } : {}), ...(patch.color ? { color: Number.parseInt(role.color.slice(1), 16) } : {}), ...(typeof patch.hoist === 'boolean' ? { hoist: role.hoist } : {}), ...(typeof patch.mentionable === 'boolean' ? { mentionable: role.mentionable } : {}) })
    });
    if (!response.ok) throw new Error('Discord rejected this role update. Check the bot role hierarchy.');
  }
  (await all())[guildId] = roles;
  await persist();
  return role;
}

export async function createRole(guildId: string, payload: { name: string; color?: string; hoist?: boolean; mentionable?: boolean }): Promise<ManagedRole> {
  const token = process.env.BOT_TOKEN;
  if (!token) throw new Error('BOT_TOKEN is required for Discord role management.');
  const response = await fetch(`https://discord.com/api/v10/guilds/${guildId}/roles`, { method: 'POST', headers: { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: payload.name.trim().slice(0, 100), color: payload.color ? Number.parseInt(payload.color.slice(1), 16) : 0, hoist: payload.hoist ?? false, mentionable: payload.mentionable ?? false }) });
  if (!response.ok) throw new Error('Discord rejected role creation. Check Manage Roles permission.');
  const role = await response.json() as { id: string; name: string; color: number; position: number; managed: boolean; hoist: boolean; mentionable: boolean };
  const result: ManagedRole = { ...role, color: role.color ? `#${role.color.toString(16).padStart(6, '0')}` : '#99aab5', permissions: [] };
  const roles = await all();
  roles[guildId] = [...(roles[guildId] ?? []), result];
  await persist();
  return result;
}

export async function deleteRole(guildId: string, roleId: string): Promise<void> {
  const token = process.env.BOT_TOKEN;
  if (!token) throw new Error('BOT_TOKEN is required for Discord role management.');
  const response = await fetch(`https://discord.com/api/v10/guilds/${guildId}/roles/${roleId}`, { method: 'DELETE', headers: { Authorization: `Bot ${token}` } });
  if (!response.ok) throw new Error('Discord rejected role deletion. Check role hierarchy and permissions.');
  const roles = await all();
  roles[guildId] = (roles[guildId] ?? []).filter(role => role.id !== roleId);
  await persist();
}