# Railway Deployment

This project can run on Railway without Docker. Create three Railway services from the same GitHub repository.

## Required services

1. `management-bot-api`
2. `management-bot`
3. `management-bot-dashboard`

Use the `deployment` branch.

## Service 1: API

Railway service settings:

- Root directory: `/`
- Build command: `npm install && npm run build --workspace @management-bot/shared && npm run build --workspace @management-bot/database && npm run build --workspace @management-bot/api`
- Start command: `npm run start --workspace @management-bot/api`
- Healthcheck path: `/health`
- Port: Railway-provided `PORT` is preferred; set `API_PORT` to the same value only if your service requires it.

Variables:

```env
PORT=${{PORT}}
API_KEY=long_random_secret
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_server_only_service_role_key
DASHBOARD_ORIGIN=https://your-dashboard-domain.up.railway.app
DATA_DIR=./data
```

Railway supplies `PORT` automatically. The API uses `PORT` first and falls back to `API_PORT` for local development.

## Service 2: Bot

Railway service settings:

- Root directory: `/`
- Build command: `npm install && npm run build --workspace @management-bot/shared && npm run build --workspace @management-bot/database && npm run build --workspace @management-bot/bot`
- Start command: `npm run start --workspace @management-bot/bot`
- No public port is required.

Variables:

```env
BOT_TOKEN=your_discord_bot_token
CLIENT_ID=your_discord_application_id
GUILD_ID=your_test_guild_id_optional
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_server_only_service_role_key
DATA_DIR=./data
```

The Bot service must stay running. Do not use a one-off command or a serverless function for the Discord gateway process.

## Service 3: Dashboard

Railway service settings:

- Root directory: `/`
- Build command: `npm install && npm run build --workspace @management-bot/dashboard`
- Start command: `npm run start --workspace @management-bot/dashboard`
- Public networking: enabled

Variables:

```env
NEXT_PUBLIC_API_URL=https://your-api-domain.up.railway.app
NEXT_PUBLIC_API_KEY=the_same_value_as_API_KEY
```

Important: `NEXT_PUBLIC_*` values are visible in the browser. The API key is only a temporary protection layer. For production security, add Discord OAuth2 and move API calls behind a same-origin server-side route.

## Deployment order

1. Create the Supabase project.
2. Run `supabase/schema.sql` in Supabase SQL Editor.
3. Deploy the API service.
4. Deploy the Bot service.
5. Deploy the Dashboard service.
6. Copy the Railway Dashboard domain into the API `DASHBOARD_ORIGIN` variable.
7. Copy the Railway API domain into Dashboard `NEXT_PUBLIC_API_URL`.
8. Redeploy API and Dashboard after changing those variables.
9. Invite the bot to Discord.
10. Open the Dashboard and enter your guild ID.

## Railway health check

After deployment, open:

```text
https://your-api-domain.up.railway.app/health
```

Expected response:

```json
{"status":"ok","service":"management-bot-api"}
```

## Railway storage note

Railway containers can be restarted or replaced. Supabase is therefore the real persistence layer. Keep `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` configured on both API and Bot services. The local `DATA_DIR` JSON fallback is only for development or temporary recovery.

## GitHub branch

Push the branch first:

```bash
git add .
git commit -m "Add Railway deployment guide"
git push -u origin deployment
```

Then connect the repository to Railway and select the `deployment` branch for all three services.
