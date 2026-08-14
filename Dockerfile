# Shared dependency/source base for both the application build and the
# migration image, so neither has to redo `pnpm install` or duplicate the
# source copy.
FROM node:22-alpine AS workspace
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.28.2 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile

COPY . .

FROM workspace AS builder
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

# Migration/Phoenix release image: shares `workspace`'s deps/source with
# `builder`, but never runs the Next.js build — so it has no Google Fonts
# dependency, no Git binary and no `.git` directory. Code identity is baked in
# at build time instead, since `resolveCodeSha()` can't fall back to
# `git rev-parse HEAD` here.
FROM workspace AS phoenix-migrate
ARG PHOENIX_CODE_SHA
RUN if ! printf '%s' "$PHOENIX_CODE_SHA" | grep -qE '^[0-9a-f]{40}$'; then \
      echo "PHOENIX_CODE_SHA must be exactly 40 lowercase hexadecimal characters" >&2; \
      exit 1; \
    fi && \
    printf '%s\n' "$PHOENIX_CODE_SHA" > /app/.phoenix-code-sha && \
    chmod 0444 /app/.phoenix-code-sha
LABEL org.opencontainers.image.revision=$PHOENIX_CODE_SHA

FROM node:22-alpine AS runner
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.28.2 --activate

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

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
