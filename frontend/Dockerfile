# Debian slim (glibc), not alpine: Tailwind v4's lightningcss native binary
# fails to resolve on musl, so we use glibc to get its prebuilt .node addon.

# ---- deps ----
FROM node:20-slim AS deps
WORKDIR /app
# `npm ci` keeps the lockfile's pinned versions (e.g. @auth0/nextjs-auth0
# compatible with next 15.5.4). But the macOS-generated lockfile omits the Linux
# native binaries Tailwind v4 needs (lightningcss + @tailwindcss/oxide) — a known
# npm bug where optional deps not installed on the lockfile's host OS are dropped.
# So after install we explicitly add the arch- and version-matched binaries.
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps \
    && ARCH=$(node -p "process.arch") \
    && LCSS=$(node -p "JSON.parse(require('fs').readFileSync('node_modules/lightningcss/package.json','utf8')).version") \
    && OXIDE=$(node -p "JSON.parse(require('fs').readFileSync('node_modules/@tailwindcss/oxide/package.json','utf8')).version") \
    && npm install --no-save --legacy-peer-deps \
       "lightningcss-linux-${ARCH}-gnu@${LCSS}" \
       "@tailwindcss/oxide-linux-${ARCH}-gnu@${OXIDE}"

# ---- builder ----
FROM node:20-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* vars are inlined into the client bundle at build time,
# so they must be provided as build args (not runtime env).
ARG NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
ARG NEXT_PUBLIC_BACKEND_WS=ws://localhost:8000
ARG NEXT_PUBLIC_FIREBASE_API_KEY
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID
ARG NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
ARG NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
ARG NEXT_PUBLIC_FIREBASE_APP_ID
ARG NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
ENV NEXT_PUBLIC_BACKEND_URL=$NEXT_PUBLIC_BACKEND_URL \
    NEXT_PUBLIC_BACKEND_WS=$NEXT_PUBLIC_BACKEND_WS \
    NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY \
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN \
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID \
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=$NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET \
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=$NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID \
    NEXT_PUBLIC_FIREBASE_APP_ID=$NEXT_PUBLIC_FIREBASE_APP_ID \
    NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=$NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID \
    NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ---- runner ----
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1

RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs nextjs

# Uses Next.js standalone output (set in next.config.ts)
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
