FROM node:22-alpine AS builder

WORKDIR /app

RUN corepack enable

ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/frontend/package.json apps/frontend/package.json
COPY packages packages

RUN pnpm install --frozen-lockfile

COPY apps/frontend apps/frontend

RUN pnpm --filter frontend build

FROM nginx:alpine

COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/frontend/dist /usr/share/nginx/html

EXPOSE 80
