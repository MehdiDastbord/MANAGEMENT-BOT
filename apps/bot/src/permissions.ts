export type PermissionAction =
  | 'moderation.ban'
  | 'moderation.kick'
  | 'moderation.timeout'
  | 'moderation.warn'
  | 'moderation.manage'
  | 'channels.manage'
  | 'roles.manage'
  | 'logs.view'
  | 'automod.manage'
  | 'tickets.manage'
  | 'exchange.review'
  | 'exchange.approve'
  | 'dashboard.access'
  | 'automod.configure';

export const defaultPermissions: Record<string, PermissionAction[]> = {
  owner: [
    'moderation.ban',
    'moderation.kick',
    'moderation.timeout',
    'moderation.warn',
    'moderation.manage',
    'channels.manage',
    'roles.manage',
    'logs.view',
    'automod.manage',
    'tickets.manage',
    'exchange.review',
    'exchange.approve',
    'dashboard.access',
    'automod.configure'
  ],
  administrator: [
    'moderation.ban',
    'moderation.kick',
    'moderation.timeout',
    'moderation.warn',
    'moderation.manage',
    'channels.manage',
    'roles.manage',
    'logs.view',
    'automod.manage',
    'tickets.manage',
    'exchange.review',
    'exchange.approve',
    'dashboard.access'
  ],
  moderator: ['moderation.kick', 'moderation.timeout', 'moderation.warn', 'moderation.manage', 'tickets.manage', 'exchange.review'],
  support: ['tickets.manage', 'exchange.review'],
  member: []
};

export function hasPermission(
  userRoles: string[],
  requiredPermission: PermissionAction,
  roleMap: Record<string, PermissionAction[]> = defaultPermissions
): boolean {
  for (const role of userRoles) {
    const actions = roleMap[role] ?? [];
    if (actions.includes(requiredPermission)) return true;
  }
  return false;
}
