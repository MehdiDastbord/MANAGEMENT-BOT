-- TEHRAN CLUB BOT Supabase schema
-- Run this file in Supabase SQL Editor before setting SUPABASE_* variables.
create extension if not exists pgcrypto;

create type public.supported_language as enum ('en', 'fa');
create type public.ticket_status as enum ('open', 'claimed', 'closed', 'reopened');
create type public.exchange_status as enum ('pending', 'approved', 'rejected', 'expired', 'cancelled', 'reopened');
create type public.moderation_action as enum ('warn', 'timeout', 'kick', 'ban', 'unban', 'clear', 'lock', 'unlock');
create type public.giveaway_status as enum ('scheduled', 'active', 'ended', 'cancelled');

create table public.guilds (
  id uuid primary key default gen_random_uuid(), discord_id text not null unique,
  name text not null default '', icon_url text, owner_discord_id text,
  language public.supported_language not null default 'en', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.guild_settings (
  guild_id text primary key references public.guilds(discord_id) on delete cascade,
  modules jsonb not null default '{}'::jsonb, channels jsonb not null default '{}'::jsonb,
  messages jsonb not null default '{}'::jsonb, config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create table public.guild_permissions (
  id uuid primary key default gen_random_uuid(), guild_id text not null references public.guilds(discord_id) on delete cascade,
  subject_type text not null check (subject_type in ('role', 'user')), subject_id text not null, action text not null, allowed boolean not null default true,
  unique(guild_id, subject_type, subject_id, action)
);
create table public.guild_members (
  guild_id text not null references public.guilds(discord_id) on delete cascade, user_id text not null,
  username text not null default '', joined_at timestamptz, left_at timestamptz, inviter_id text, fake_join boolean not null default false,
  xp bigint not null default 0, level integer not null default 0, messages bigint not null default 0, invites integer not null default 0,
  balance bigint not null default 0, reputation integer not null default 0, metadata jsonb not null default '{}'::jsonb,
  primary key(guild_id, user_id)
);
create table public.role_configurations (id uuid primary key default gen_random_uuid(), guild_id text not null references public.guilds(discord_id) on delete cascade, role_id text not null, name text, color text, permissions jsonb not null default '{}'::jsonb, metadata jsonb not null default '{}'::jsonb, unique(guild_id, role_id));
create table public.channel_configurations (id uuid primary key default gen_random_uuid(), guild_id text not null references public.guilds(discord_id) on delete cascade, channel_id text not null, kind text not null, metadata jsonb not null default '{}'::jsonb, unique(guild_id, channel_id, kind));
create table public.warnings (id bigserial primary key, guild_id text not null references public.guilds(discord_id) on delete cascade, user_id text not null, moderator_id text not null, reason text not null, created_at timestamptz not null default now());
create table public.moderation_cases (id uuid primary key default gen_random_uuid(), guild_id text not null references public.guilds(discord_id) on delete cascade, case_number bigint not null, user_id text not null, moderator_id text not null, action public.moderation_action not null, reason text, duration_seconds integer, status text not null default 'open', created_at timestamptz not null default now(), unique(guild_id, case_number));
create table public.evidence (id uuid primary key default gen_random_uuid(), guild_id text not null references public.guilds(discord_id) on delete cascade, case_id uuid references public.moderation_cases(id) on delete set null, ticket_id uuid, appeal_id uuid, url text, file_name text, message_id text, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now());
create table public.tickets (id uuid primary key default gen_random_uuid(), guild_id text not null references public.guilds(discord_id) on delete cascade, ticket_number bigint not null, channel_id text not null, user_id text not null, claimed_by text, ticket_type text not null default 'support', status public.ticket_status not null default 'open', created_at timestamptz not null default now(), closed_at timestamptz, unique(guild_id, ticket_number));
create table public.ticket_messages (id uuid primary key default gen_random_uuid(), ticket_id uuid not null references public.tickets(id) on delete cascade, author_id text not null, content text, attachments jsonb not null default '[]'::jsonb, created_at timestamptz not null default now());
create table public.ticket_ratings (id uuid primary key default gen_random_uuid(), ticket_id uuid not null references public.tickets(id) on delete cascade, user_id text not null, rating integer not null check(rating between 1 and 5), comment text, created_at timestamptz not null default now());
create table public.exchange_requests (id text primary key, guild_id text not null references public.guilds(discord_id) on delete cascade, user_id text not null, title text not null, description text not null, banner_url text, link text, extra jsonb not null default '{}'::jsonb, status public.exchange_status not null default 'pending', reviewed_by text, rejection_reason text, created_at timestamptz not null default now(), reviewed_at timestamptz);
create table public.exchange_actions (id uuid primary key default gen_random_uuid(), request_id text not null references public.exchange_requests(id) on delete cascade, actor_id text not null, action text not null, reason text, created_at timestamptz not null default now());
create table public.invite_stats (guild_id text not null references public.guilds(discord_id) on delete cascade, user_id text not null, normal_invites integer not null default 0, fake_joins integer not null default 0, leaves integer not null default 0, rejoins integer not null default 0, net_invites integer not null default 0, primary key(guild_id, user_id));
create table public.giveaways (id uuid primary key default gen_random_uuid(), guild_id text not null references public.guilds(discord_id) on delete cascade, channel_id text not null, message_id text, prize text not null, winners integer not null default 1, required_role_id text, ends_at timestamptz not null, status public.giveaway_status not null default 'active', created_by text not null, created_at timestamptz not null default now());
create table public.giveaway_entries (giveaway_id uuid not null references public.giveaways(id) on delete cascade, user_id text not null, created_at timestamptz not null default now(), primary key(giveaway_id, user_id));
create table public.economy_transactions (id uuid primary key default gen_random_uuid(), guild_id text not null references public.guilds(discord_id) on delete cascade, user_id text not null, type text not null, amount bigint not null, balance_after bigint not null, actor_id text, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now());
create table public.game_sessions (id uuid primary key default gen_random_uuid(), guild_id text not null references public.guilds(discord_id) on delete cascade, user_id text not null, game text not null, result text, score integer default 0, reward bigint default 0, created_at timestamptz not null default now());
create table public.achievements (id uuid primary key default gen_random_uuid(), guild_id text not null references public.guilds(discord_id) on delete cascade, key text not null, name text not null, description text, requirements jsonb not null default '{}'::jsonb, reward jsonb not null default '{}'::jsonb, hidden boolean not null default false, unique(guild_id, key));
create table public.member_achievements (guild_id text not null references public.guilds(discord_id) on delete cascade, user_id text not null, achievement_id uuid not null references public.achievements(id) on delete cascade, earned_at timestamptz not null default now(), primary key(guild_id, user_id, achievement_id));
create table public.badges (id uuid primary key default gen_random_uuid(), guild_id text not null references public.guilds(discord_id) on delete cascade, key text not null, name text not null, icon_url text, requirements jsonb not null default '{}'::jsonb, unique(guild_id, key));
create table public.member_badges (guild_id text not null references public.guilds(discord_id) on delete cascade, user_id text not null, badge_id uuid not null references public.badges(id) on delete cascade, awarded_at timestamptz not null default now(), primary key(guild_id, user_id, badge_id));
create table public.reputation_events (id uuid primary key default gen_random_uuid(), guild_id text not null references public.guilds(discord_id) on delete cascade, from_user_id text not null, to_user_id text not null, amount integer not null, reason text, created_at timestamptz not null default now());
create table public.polls (id uuid primary key default gen_random_uuid(), guild_id text not null references public.guilds(discord_id) on delete cascade, channel_id text not null, message_id text, question text not null, options jsonb not null, multiple_choice boolean not null default false, anonymous boolean not null default false, ends_at timestamptz, created_by text not null, created_at timestamptz not null default now());
create table public.poll_votes (poll_id uuid not null references public.polls(id) on delete cascade, user_id text not null, choices jsonb not null, created_at timestamptz not null default now(), primary key(poll_id, user_id));
create table public.forms (id uuid primary key default gen_random_uuid(), guild_id text not null references public.guilds(discord_id) on delete cascade, name text not null, fields jsonb not null default '[]'::jsonb, automation_id uuid, created_at timestamptz not null default now());
create table public.form_submissions (id uuid primary key default gen_random_uuid(), form_id uuid not null references public.forms(id) on delete cascade, user_id text not null, values jsonb not null, created_at timestamptz not null default now());
create table public.automations (id uuid primary key default gen_random_uuid(), guild_id text not null references public.guilds(discord_id) on delete cascade, name text not null, enabled boolean not null default true, trigger jsonb not null, conditions jsonb not null default '[]'::jsonb, actions jsonb not null default '[]'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.scheduled_messages (id uuid primary key default gen_random_uuid(), guild_id text not null references public.guilds(discord_id) on delete cascade, channel_id text not null, payload jsonb not null, schedule text not null, next_run_at timestamptz, enabled boolean not null default true, created_at timestamptz not null default now());
create table public.webhook_configurations (id uuid primary key default gen_random_uuid(), guild_id text not null references public.guilds(discord_id) on delete cascade, channel_id text, webhook_id text, name text, external_url text, secret_hash text, enabled boolean not null default true, created_at timestamptz not null default now());
create table public.appeals (id uuid primary key default gen_random_uuid(), guild_id text not null references public.guilds(discord_id) on delete cascade, case_id uuid references public.moderation_cases(id) on delete set null, user_id text not null, content text not null, status text not null default 'pending', reviewed_by text, response text, created_at timestamptz not null default now(), reviewed_at timestamptz);
create table public.transcripts (id uuid primary key default gen_random_uuid(), guild_id text not null references public.guilds(discord_id) on delete cascade, ticket_id uuid references public.tickets(id) on delete cascade, storage_path text, content text, created_at timestamptz not null default now());
create table public.audit_entries (id bigserial primary key, guild_id text references public.guilds(discord_id) on delete cascade, actor_id text, action text not null, target_id text, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now());
create table public.analytics_events (id bigserial primary key, guild_id text references public.guilds(discord_id) on delete cascade, event_type text not null, user_id text, value numeric, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now());
create table public.dashboard_users (id uuid primary key default gen_random_uuid(), discord_id text not null unique, username text, avatar_url text, created_at timestamptz not null default now(), last_login_at timestamptz);
create table public.dashboard_sessions (id uuid primary key default gen_random_uuid(), user_id uuid not null references public.dashboard_users(id) on delete cascade, token_hash text not null unique, expires_at timestamptz not null, created_at timestamptz not null default now());

create index on public.audit_entries(guild_id, created_at desc);
create index on public.analytics_events(guild_id, event_type, created_at desc);
create index on public.warnings(guild_id, user_id, created_at desc);
create index on public.exchange_requests(guild_id, status, created_at desc);
create index on public.tickets(guild_id, status, created_at desc);
create index on public.economy_transactions(guild_id, user_id, created_at desc);

alter table public.guilds enable row level security;
alter table public.guild_settings enable row level security;
alter table public.dashboard_users enable row level security;
alter table public.dashboard_sessions enable row level security;
-- Service-role access is used by the API. Add authenticated policies after OAuth is configured.
