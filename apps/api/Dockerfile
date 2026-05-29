# Purpose: Docker image definition for the JIMPITAN NestJS API.
# Caller: Docker build, CI/CD, and production deployment.
# Deps: Node.js, npm, Prisma schema, scripts/run-prisma-schema-command.mjs, apps/api TypeScript source.
# MainFuncs: Installs dependencies, generates Prisma client, builds API, and starts compiled server.
# SideEffects: Produces a container image with compiled backend artifacts.

FROM node:20-bookworm-slim AS deps
WORKDIR /app
ENV npm_config_cache=/tmp/npm-cache
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

FROM deps AS build
WORKDIR /app
COPY tsconfig.base.json ./
COPY scripts/run-prisma-schema-command.mjs ./scripts/run-prisma-schema-command.mjs
COPY prisma ./prisma
COPY apps/api ./apps/api
RUN npm run prisma:generate
RUN npm run build:api

FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV npm_config_cache=/tmp/npm-cache
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY prisma ./prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build /app/dist/apps/api ./dist
RUN mkdir -p /var/lib/jimpitan/uploads /var/lib/jimpitan/exports && chown -R node:node /app /var/lib/jimpitan
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD node -e "const http=require('http');const req=http.get('http://127.0.0.1:3001/api/v1/health',res=>process.exit(res.statusCode===200?0:1));req.on('error',()=>process.exit(1));req.setTimeout(4000,()=>{req.destroy();process.exit(1);});"
CMD ["node", "dist/main.js"]
