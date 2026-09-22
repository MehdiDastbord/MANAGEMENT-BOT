# Deployment Guide

For a no-Docker deployment, use [RAILWAY.md](RAILWAY.md). It explains how to create separate Railway services for the API, Bot, and Dashboard.

This repository is a monorepo with three runnable services:

- `apps/bot`: Discord gateway process
- `apps/api`: configuration API
- `apps/dashboard`: website/dashboard

The bot and API need a server that stays online. The dashboard can run on the same server, a Docker host, or a Next.js provider.

## 1. Create Discord application

1. Open the Discord Developer Portal.
2. Create an application and open the Bot page.
3. Copy the bot token into `BOT_TOKEN`.
4. Copy the application ID into `CLIENT_ID`.
5. Enable these privileged intents:
   - Server Members Intent
   - Message Content Intent
6. Generate an invite from OAuth2 URL Generator with scopes `bot` and `applications.commands`.
7. Grant only the permissions the bot needs. For the current modules, the bot needs View Channels, Send Messages, Embed Links, Read Message History, Manage Messages, Moderate Members, Manage Channels, and Manage Roles where those modules are enabled.

Never put `BOT_TOKEN` in the website or any `NEXT_PUBLIC_` variable.

## 1.1 Create the Supabase database

1. Create a Supabase project.
2. Open SQL Editor.
3. Run [supabase/schema.sql](supabase/schema.sql) completely.
4. Copy the project URL and keys into `HOSTING_CONFIG.env.example`.
5. Use the service-role key only on the bot/API server. Do not put it in a `NEXT_PUBLIC_` variable.

## 2. Configure environment

Copy `.env.example` to `.env` and set:

```env
BOT_TOKEN=...
CLIENT_ID=...
API_KEY=generate_a_long_random_value
NEXT_PUBLIC_API_KEY=the_same_value
NEXT_PUBLIC_API_URL=https://api.example.com
DASHBOARD_ORIGIN=https://dashboard.example.com
```

`GUILD_ID` is optional. Set it while developing to register commands immediately in one server. Without it, the bot registers global commands and Discord can take up to one hour to publish them.

The complete one-file template is [HOSTING_CONFIG.env.example](HOSTING_CONFIG.env.example). Fill that file and rename it to `.env` on the host.

Generate a key with:

```bash
openssl rand -hex 32
```

For a single Docker host, `NEXT_PUBLIC_API_URL` can be `http://your-domain:3001`, but HTTPS with a reverse proxy is strongly recommended.

## 3. Run locally

```bash
npm install
npm run build
npm run dev:api
npm run dev:bot
npm run dev:dashboard
```

Open the dashboard at `http://localhost:3000`.

## 4. Run with Docker

```bash
cp .env.example .env
# edit .env
npm install
docker compose up -d --build
```

Services:

- Dashboard: `http://localhost:3000`
- API: `http://localhost:3001`
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`

With `SUPABASE_URL` and a Supabase key configured, guild configuration and bot records are synchronized through Supabase. The shared `DATA_DIR` JSON file remains a local fallback if Supabase is unavailable.

## 5. Put the website on a host

### Docker/VPS

Use the included `docker-compose.yml`. Point a domain/reverse proxy at port `3000` for the dashboard and port `3001` for the API. Set `DASHBOARD_ORIGIN` to the exact dashboard origin.

### Next.js hosting

For a Next.js host:

- Root directory: `apps/dashboard`
- Build command: `npm run build --workspace @management-bot/dashboard` from the repository root, or use the provider's monorepo setting
- Start command: `npm run start --workspace @management-bot/dashboard`
- Environment: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_API_KEY`

The API must be deployed separately and reachable from the browser. If your provider does not support the workspace build command, use Docker instead.

## 6. Connect a guild

1. Start the API and bot.
2. Invite the bot to the server.
3. Open the dashboard.
4. Enter the Discord guild ID and click `Load`.
5. Set channel IDs and enable modules.
6. Save configuration.

The API and bot share `data/guilds.json`, so dashboard changes are visible to the running bot after configuration reload/use.

## 7. Push this branch

This work is on the local `deployment` branch. To publish it:

```bash
git add .
git commit -m "Build deployable management bot platform"
git push -u origin deployment
```

Then deploy from the `deployment` branch in your hosting provider.

## Production caveats

The current implementation is a working core, not a claim that every item in the specification is already implemented. Before public launch, add Discord OAuth2 login, server-side dashboard authorization, PostgreSQL migrations, Redis queues, HTTPS, backups, monitoring, and a reverse proxy. The API key currently protects API routes but is exposed to the browser because the dashboard calls the API directly; for stronger security, put the API behind a same-origin server-side proxy and use Discord OAuth2 sessions.
