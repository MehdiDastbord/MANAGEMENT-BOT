FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
COPY apps/bot/package.json ./apps/bot/package.json
COPY packages/shared/package.json ./packages/shared/package.json
COPY packages/database/package.json ./packages/database/package.json
COPY packages/database/src ./packages/database/src
COPY packages/database/tsconfig.json ./packages/database/tsconfig.json
COPY packages/shared/src ./packages/shared/src
COPY packages/shared/tsconfig.json ./packages/shared/tsconfig.json
COPY apps/bot/src ./apps/bot/src
COPY apps/bot/tsconfig.json ./apps/bot/tsconfig.json
RUN npm install
RUN npm run build --workspace @management-bot/shared && npm run build --workspace @management-bot/database && npm run build --workspace @management-bot/bot
CMD ["npm", "run", "start", "--workspace", "@management-bot/bot"]
