# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS build

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@10.4.1 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
COPY patches ./patches

# Dev dependencies are required to compile. Do not set NODE_ENV=production yet.
RUN pnpm install --frozen-lockfile

COPY . .

# VITE_* are compiled into the browser bundle. Server secrets stay runtime env.
ARG VITE_APP_ID=""
ARG VITE_OAUTH_PORTAL_URL=""
ARG VITE_STRIPE_PUBLISHABLE_KEY=""
ARG VITE_FRONTEND_FORGE_API_KEY=""
ARG VITE_FRONTEND_FORGE_API_URL=""
ARG VITE_ANALYTICS_ENDPOINT=""
ARG VITE_ANALYTICS_WEBSITE_ID=""

ENV VITE_APP_ID=$VITE_APP_ID \
    VITE_OAUTH_PORTAL_URL=$VITE_OAUTH_PORTAL_URL \
    VITE_STRIPE_PUBLISHABLE_KEY=$VITE_STRIPE_PUBLISHABLE_KEY \
    VITE_FRONTEND_FORGE_API_KEY=$VITE_FRONTEND_FORGE_API_KEY \
    VITE_FRONTEND_FORGE_API_URL=$VITE_FRONTEND_FORGE_API_URL \
    VITE_ANALYTICS_ENDPOINT=$VITE_ANALYTICS_ENDPOINT \
    VITE_ANALYTICS_WEBSITE_ID=$VITE_ANALYTICS_WEBSITE_ID \
    SKIP_MANUS_RUNTIME=1

RUN pnpm build \
  && node --input-type=module -e "import('sharp').then(() => console.log('sharp ok')).catch((error) => { console.error(error); process.exit(1); })"

FROM node:22-bookworm-slim AS runtime

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/dist ./dist
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/drizzle.config.ts ./drizzle.config.ts
COPY docker/entrypoint.sh /entrypoint.sh

RUN chmod +x /entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["/entrypoint.sh"]
