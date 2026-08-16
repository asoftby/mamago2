FROM node:22-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.28.2 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile

COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Fail-loud: abort the image build when manifest.csv is missing, has fewer
# redirect rows than REDIRECT_MANIFEST_MIN_ROWS (default 850), or fails
# validation. The SEO redirect manifest must never silently ship empty.
ARG REDIRECT_MANIFEST_MIN_ROWS=850
ENV REDIRECT_MANIFEST_MIN_ROWS=${REDIRECT_MANIFEST_MIN_ROWS}
ENV REQUIRE_REDIRECT_MANIFEST=1
# NEXT_PUBLIC_* vars are inlined into the client bundle at `next build` time,
# not read from the running container's environment — they must be passed as
# build args, not just runtime env vars on the host.
ARG NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
ENV NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=${NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}
ARG NEXT_PUBLIC_GOOGLE_MAP_ID
ENV NEXT_PUBLIC_GOOGLE_MAP_ID=${NEXT_PUBLIC_GOOGLE_MAP_ID}
RUN pnpm build:ci

FROM node:22-alpine AS runner
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.28.2 --activate

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Runtime build/release identity for /api/health — baked in at image build
# time from CI (see .github/workflows/docker.yml), never derived from a
# .git directory at runtime.
ARG BUILD_ID
ENV BUILD_ID=${BUILD_ID}
ARG GIT_COMMIT_SHA
ENV GIT_COMMIT_SHA=${GIT_COMMIT_SHA}

RUN apk add --no-cache curl

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

EXPOSE 3000
CMD ["./docker-entrypoint.sh"]
