FROM node:22-alpine

WORKDIR /app
RUN corepack enable

COPY . .

RUN pnpm install
RUN pnpm --filter backend prisma generate || true
RUN pnpm --filter backend build

EXPOSE 3000

CMD ["node", "apps/backend/dist/main.js"]
