export const botModules = {
  moderation: {
    name: 'moderation',
    enabled: true,
    description: 'Moderation tools, warnings, cases, and audit logs.'
  },
  tickets: {
    name: 'tickets',
    enabled: true,
    description: 'Ticket creation, management, staff assignment and transcripts.'
  },
  exchange: {
    name: 'exchange',
    enabled: true,
    description: 'Exchange review requests and approvals.'
  },
  invites: {
    name: 'invites',
    enabled: true,
    description: 'Invite tracking, fake join detection and rewards.'
  },
  xp: {
    name: 'xp',
    enabled: true,
    description: 'Levels, ranks and leaderboard management.'
  },
  giveaways: {
    name: 'giveaways',
    enabled: true,
    description: 'Giveaway entries, schedules and winner selection.'
  },
  economy: {
    name: 'economy',
    enabled: true,
    description: 'Balances, transactions and role rewards.'
  },
  automod: {
    name: 'automod',
    enabled: true,
    description: 'Auto detection for spam, links and raid-like behavior.'
  },
  logs: {
    name: 'logs',
    enabled: true,
    description: 'Audit events, dashboard actions and moderation logs.'
  }
};

export function getEnabledModules() {
  return Object.values(botModules).filter((module) => module.enabled);
}
