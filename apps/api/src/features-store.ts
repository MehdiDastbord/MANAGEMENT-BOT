import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export type FeatureName = 'automations' | 'announcements' | 'scheduledMessages' | 'polls' | 'forms' | 'reputation' | 'achievements' | 'appeals';
export type FeatureRecord = Record<string, unknown> & { id: string; createdAt: string; updatedAt: string };
type GuildFeatures = Record<FeatureName, FeatureRecord[]>;

const path = join(process.env.DATA_DIR ?? join(process.cwd(), 'data'), 'features.json');
let cache: Record<string, GuildFeatures> | null = null;

const featureNames: FeatureName[] = ['automations', 'announcements', 'scheduledMessages', 'polls', 'forms', 'reputation', 'achievements', 'appeals'];
function emptyFeatures(): GuildFeatures { return Object.fromEntries(featureNames.map(name => [name, []])) as unknown as GuildFeatures; }
async function all(): Promise<Record<string, GuildFeatures>> {
  if (cache) return cache;
  try { cache = JSON.parse(await readFile(path, 'utf8')) as Record<string, GuildFeatures>; } catch { cache = {}; }
  return cache;
}
async function persist(): Promise<void> { await mkdir(dirname(path), { recursive: true }); await writeFile(path, JSON.stringify(await all(), null, 2)); }
function assertFeature(value: string): asserts value is FeatureName { if (!featureNames.includes(value as FeatureName)) throw new Error(`Unsupported feature: ${value}`); }

export async function listFeature(guildId: string, feature: string): Promise<FeatureRecord[]> { assertFeature(feature); const data = await all(); data[guildId] ??= emptyFeatures(); data[guildId][feature] ??= []; return data[guildId][feature]; }
export async function createFeature(guildId: string, feature: string, payload: Record<string, unknown>): Promise<FeatureRecord> { assertFeature(feature); const records = await listFeature(guildId, feature); const now = new Date().toISOString(); const record = { ...payload, id: crypto.randomUUID(), createdAt: now, updatedAt: now }; records.push(record); await persist(); return record; }
export async function updateFeature(guildId: string, feature: string, id: string, payload: Record<string, unknown>): Promise<FeatureRecord | null> { const records = await listFeature(guildId, feature); const index = records.findIndex(record => record.id === id); if (index < 0) return null; records[index] = { ...records[index], ...payload, id, updatedAt: new Date().toISOString() }; await persist(); return records[index]; }
export async function deleteFeature(guildId: string, feature: string, id: string): Promise<boolean> { const records = await listFeature(guildId, feature); const index = records.findIndex(record => record.id === id); if (index < 0) return false; records.splice(index, 1); await persist(); return true; }
export async function exportGuild(guildId: string): Promise<GuildFeatures> { const data = await all(); data[guildId] ??= emptyFeatures(); return structuredClone(data[guildId]); }
export async function importGuild(guildId: string, payload: Partial<GuildFeatures>): Promise<GuildFeatures> { const data = await all(); data[guildId] ??= emptyFeatures(); for (const feature of featureNames) if (Array.isArray(payload[feature])) data[guildId][feature] = payload[feature] as FeatureRecord[]; await persist(); return data[guildId]; }
export { featureNames };
