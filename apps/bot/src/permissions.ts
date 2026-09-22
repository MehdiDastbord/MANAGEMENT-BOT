export type PermissionAction =
  | 'moderation.ban'
  | 'moderation.kick'
  | 'moderation.timeout'
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
    'tickets.manage',
    'exchange.review',
    'exchange.approve',
    'dashboard.access'
  ],
  moderator: ['moderation.kick', 'moderation.timeout', 'tickets.manage', 'exchange.review'],
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
