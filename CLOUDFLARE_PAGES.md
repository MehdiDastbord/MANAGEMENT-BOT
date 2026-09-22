# Cloudflare Pages Dashboard

The dashboard is configured as a static Next.js export. Host only the dashboard on Cloudflare Pages. Keep the Discord Bot and API on Railway.

## Create the Pages project

1. Open Cloudflare Dashboard.
2. Go to **Workers & Pages**.
3. Choose **Create application** → **Pages** → **Connect to Git**.
4. Select the GitHub repository.
5. Select branch:

```text
deployment
```

## Build settings

Use these exact values:

```text
Framework preset: Next.js (Static HTML Export)
Root directory: /
Build command: npm install && npm run build --workspace @management-bot/dashboard
Build output directory: apps/dashboard/out
Node version: 22
```

If Cloudflare asks whether the root directory is the repository root, choose the repository root, not `apps/dashboard`.

## Environment variables

Add this variable in **Settings → Environment variables → Production**:

```text
NEXT_PUBLIC_API_URL=https://management-bot-production.up.railway.app
```

Add this too if your Railway API requires the API key:

```text
NEXT_PUBLIC_API_KEY=the_same_value_as_API_KEY
```

`NEXT_PUBLIC_*` variables are visible to browser users. Never add these to Cloudflare Pages:

```text
BOT_TOKEN
SUPABASE_SERVICE_ROLE_KEY
DISCORD_CLIENT_SECRET
SESSION_SECRET
```

## API CORS setting

After Cloudflare gives you a Pages domain, set this in the Railway API service:

```text
DASHBOARD_ORIGIN=https://your-project.pages.dev
```

Then redeploy the API. If you later add a custom domain, use that exact domain instead.

## Verify

Open your Pages URL and enter your Discord guild ID. The dashboard should load its configuration from:

```text
https://management-bot-production.up.railway.app/api/guilds/YOUR_GUILD_ID/config
```

The Bot remains on Railway and continues to use the same Supabase project.
