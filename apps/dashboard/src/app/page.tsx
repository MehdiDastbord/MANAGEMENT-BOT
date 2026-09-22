'use client';

import { useEffect, useState } from 'react';

type Config = {
  guildId: string;
  language: 'en' | 'fa';
  modules: Record<string, boolean>;
  channels: Record<string, string | undefined>;
  messages: { welcome: string };
};
type FeatureName = 'automations' | 'announcements' | 'scheduledMessages' | 'polls' | 'forms' | 'reputation' | 'achievements' | 'appeals';
type FeatureRecord = { id: string; createdAt: string; updatedAt: string; [key: string]: unknown };

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const apiKey = process.env.NEXT_PUBLIC_API_KEY;
const apiHeaders = apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined;

export default function HomePage() {
  const [error, setError] = useState('');
  const [guildId, setGuildId] = useState('demo-guild');
  const [config, setConfig] = useState<Config | null>(null);
  const [saved, setSaved] = useState(false);
  const [feature, setFeature] = useState<FeatureName>('automations');
  const [records, setRecords] = useState<FeatureRecord[]>([]);
  const [recordName, setRecordName] = useState('');

  async function load() {
    try {
      setError('');
      const response = await fetch(`${apiUrl}/api/guilds/${guildId}/config`, { headers: apiHeaders });
      if (!response.ok) throw new Error('The API rejected this request.');
      setConfig(await response.json() as Config);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not connect to the API.');
    }
  }

  useEffect(() => { void load(); }, []);

  async function loadFeature(nextFeature = feature) {
    const response = await fetch(`${apiUrl}/api/guilds/${guildId}/${nextFeature}`, { headers: apiHeaders });
    if (response.ok) setRecords(await response.json() as FeatureRecord[]);
  }

  useEffect(() => { void loadFeature(); }, [feature, guildId]);

  async function addFeature() {
    if (!recordName.trim()) return;
    const response = await fetch(`${apiUrl}/api/guilds/${guildId}/${feature}`, { method: 'POST', headers: { 'content-type': 'application/json', ...(apiHeaders ?? {}) }, body: JSON.stringify({ name: recordName.trim(), enabled: true }) });
    if (response.ok) { setRecordName(''); await loadFeature(); }
  }

  async function removeFeature(id: string) {
    await fetch(`${apiUrl}/api/guilds/${guildId}/${feature}/${id}`, { method: 'DELETE', headers: apiHeaders });
    await loadFeature();
  }

  async function saveConfig() {
    if (!config) return;
    const response = await fetch(`${apiUrl}/api/guilds/${guildId}/config`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', ...(apiHeaders ?? {}) },
      body: JSON.stringify(config)
    });
    if (!response.ok) { setError('The configuration could not be saved.'); return; }
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">TEHRAN CLUB<span>MANAGEMENT PLATFORM</span></div>
        <p className="nav-label">CONTROL CENTER</p>
        {['Overview', 'Modules', 'Moderation', 'Tickets', 'Exchange', 'Economy', 'Analytics', 'Automations', 'Forms', 'Appeals'].map((item, index) => <button className={`nav-item ${index === 0 ? 'active' : ''}`} key={item}>{item}</button>)}
        <div className="sidebar-foot">Deployment mode<br />API-connected dashboard</div>
      </aside>
      <main className="content">
        <header className="topbar">
          <div><p className="eyebrow">DISCORD OPERATIONS</p><h1>Server control, clearly.</h1><p className="subtitle">Configure guild behavior without redeploying the bot.</p></div>
          <div className="guild-picker"><label className="field-label">Guild ID<input value={guildId} onChange={event => setGuildId(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') void load(); }} /></label><button className="primary" onClick={() => void load()}>Load</button></div>
        </header>
        {error && <p className="error">{error}</p>}
        {!config ? <p>Loading configuration...</p> : <>
          <section className="cards"><div className="metric"><strong>Connected</strong><span>Runtime configuration</span></div><div className="metric"><strong>{Object.values(config.modules).filter(Boolean).length}</strong><span>Active modules</span></div><div className="metric"><strong>{config.language.toUpperCase()}</strong><span>Server language</span></div></section>
          <section className="panel"><h2>Modules</h2><div className="module-grid">{Object.entries(config.modules).map(([name, enabled]) => <label className="module" key={name}><span>{name}</span><input type="checkbox" checked={enabled} onChange={event => setConfig({ ...config, modules: { ...config.modules, [name]: event.target.checked } })} /></label>)}</div></section>
          <section className="panel"><h2>Messages and language</h2><div className="form-grid"><label className="field-label">Welcome message<input value={config.messages.welcome} onChange={event => setConfig({ ...config, messages: { welcome: event.target.value } })} /></label><label className="field-label">Language<select value={config.language} onChange={event => setConfig({ ...config, language: event.target.value as 'en' | 'fa' })}><option value="en">English</option><option value="fa">فارسی</option></select></label></div></section>
          <section className="panel"><h2>Discord channels</h2><div className="form-grid">{[['logs', 'Log channel ID'], ['welcome', 'Welcome channel ID'], ['tickets', 'Ticket category ID'], ['exchange', 'Exchange channel ID']].map(([key, label]) => <label className="field-label" key={key}>{label}<input value={config.channels[key] ?? ''} onChange={event => setConfig({ ...config, channels: { ...config.channels, [key]: event.target.value || undefined } })} /></label>)}</div></section>
          <section className="panel"><h2>Management records</h2><div className="form-grid"><label className="field-label">Module<select value={feature} onChange={event => { const value = event.target.value as FeatureName; setFeature(value); void loadFeature(value); }}><option value="automations">Automations</option><option value="announcements">Announcements</option><option value="scheduledMessages">Scheduled messages</option><option value="polls">Polls</option><option value="forms">Forms</option><option value="reputation">Reputation rules</option><option value="achievements">Achievements</option><option value="appeals">Appeals</option></select></label><label className="field-label">New record name<input value={recordName} onChange={event => setRecordName(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') void addFeature(); }} /></label></div><button className="primary" onClick={() => void addFeature()}>Create record</button><div style={{ marginTop: 14 }}>{records.map(record => <div className="module" key={record.id}><span>{String(record.name ?? record.id)}</span><button onClick={() => void removeFeature(record.id)}>Delete</button></div>)}{records.length === 0 && <p className="subtitle">No records yet.</p>}</div></section>
          <button className="primary" onClick={() => void saveConfig()}>{saved ? 'Saved' : 'Save configuration'}</button><p className="status">{saved ? 'Configuration saved successfully.' : 'Changes remain local until you save.'}</p>
        </>}
      </main>
    </div>
  );
}
