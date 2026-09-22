FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
COPY apps/dashboard/package.json ./apps/dashboard/package.json
COPY packages/shared/package.json ./packages/shared/package.json
COPY packages/shared/src ./packages/shared/src
COPY packages/shared/tsconfig.json ./packages/shared/tsconfig.json
COPY apps/dashboard/src ./apps/dashboard/src
COPY apps/dashboard/next.config.js ./apps/dashboard/next.config.js
COPY apps/dashboard/tsconfig.json ./apps/dashboard/tsconfig.json
COPY apps/dashboard/next-env.d.ts ./apps/dashboard/next-env.d.ts
RUN npm install
RUN npm run build --workspace @management-bot/shared && npm run build --workspace @management-bot/dashboard
CMD ["npm", "run", "start", "--workspace", "@management-bot/dashboard"]
