import type { GuildData } from './store.js';

export function render(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => values[key] ?? '');
}

export function auditSummary(guild: GuildData): string {
  return guild.audit.slice(0, 10).map(entry => `${entry.createdAt} ${entry.action}`).join('\n') || 'No audit events yet.';
}
