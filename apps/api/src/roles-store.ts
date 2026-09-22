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
  const roles = await response.json() as Array<{ id: string; name: string; color: number; position: number; managed: boolean }>;
  const stored = (await all())[guildId] ?? [];
  return roles.sort((left, right) => right.position - left.position).map(role => ({
    id: role.id,
    name: role.name,
    color: role.color ? `#${role.color.toString(16).padStart(6, '0')}` : '#99aab5',
    position: role.position,
    managed: role.managed,
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
  const token = process.env.BOT_TOKEN;
  if (token && !role.managed && (patch.name || patch.color)) {
    const response = await fetch(`https://discord.com/api/v10/guilds/${guildId}/roles/${roleId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...(patch.name ? { name: role.name } : {}), ...(patch.color ? { color: Number.parseInt(role.color.slice(1), 16) } : {}) })
    });
    if (!response.ok) throw new Error('Discord rejected this role update. Check the bot role hierarchy.');
  }
  (await all())[guildId] = roles;
  await persist();
  return role;
}