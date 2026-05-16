FROM node:22-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.28.2 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# Копируем prisma до pnpm install — нужен для postinstall (prisma generate)
COPY prisma ./prisma

RUN pnpm install --frozen-lockfile

COPY . .

# Фиктивный DATABASE_URL только для сборки (не для миграций)
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
ENV NEXT_TELEMETRY_DISABLED=1

RUN pnpm build

# -------------------------------------------------------
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# standalone уже включает node_modules (в т.ч. prisma/sharp)
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Prisma schema + migrations (нужны для migrate deploy)
COPY --from=builder /app/prisma ./prisma

RUN apk add --no-cache curl

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]
