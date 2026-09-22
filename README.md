# TEHRAN CLUB BOT

A production-ready Discord management platform monorepo built around a modular TypeScript architecture.

## Included

- Discord bot app
- REST API app
- Next.js dashboard app
- Shared TypeScript package
- Multi-guild-ready configuration model
- Feature registry and permission engine
- Logging and modular expansion points for moderation, tickets, exchange, invites, XP, giveaways and economy

## Stack

- Node.js + TypeScript
- discord.js
- Fastify API
- Next.js dashboard
- PostgreSQL-ready schema foundation
- Redis-ready architecture
- Docker-ready deployment layout

## Project structure

- apps/bot: Discord application
- apps/api: backend API
- apps/dashboard: admin dashboard
- packages/shared: shared models and configuration defaults

## Quick start

1. Copy .env.example to .env and configure your values.
2. Install dependencies with npm install.
3. Start the bot:
   npm run dev:bot
4. Start the API:
   npm run dev:api
5. Start the dashboard:
   npm run dev:dashboard
6. Build the project:
   npm run build

For hosting instructions, see [DEPLOYMENT.md](DEPLOYMENT.md). The deployable work is kept on the `deployment` branch.

## Architecture notes

This repository intentionally models the high-level structure required by the specification in ABILITIES.txt and PROMPT.txt without hard-coding server IDs or role IDs.

The goal is to provide a clean base for a full management ecosystem that can be extended with modules such as:

- Ticketing
- Exchange management
- Moderation and AutoMod
- XP and invites
- Giveaways, drops and economy
- Dashboard and permission control
- Audit logging and automation

## Important

This codebase is a platform foundation and should be extended with your own database layer, OAuth session system, and production-grade dashboard permissions before being used in a live Discord server.
