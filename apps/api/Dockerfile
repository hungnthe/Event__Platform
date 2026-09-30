FROM node:22.13.0-alpine AS base
# Node 22.13 ships an older Corepack signing keyring. Install the repository's
# pinned package manager directly so Docker builds remain reproducible.
RUN npm install --global pnpm@11.19.0
WORKDIR /app
FROM base AS builder
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/eslint-config/package.json packages/eslint-config/package.json
COPY apps/api apps/api
COPY packages/contracts packages/contracts
COPY packages/tsconfig packages/tsconfig
COPY packages/eslint-config packages/eslint-config
RUN pnpm install --frozen-lockfile --prod=false
RUN pnpm --filter @eventflow/contracts build && pnpm --filter @eventflow/api prisma:generate && pnpm --filter @eventflow/api build
FROM node:22.13.0-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 eventflow && adduser --system --uid 1001 api
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/packages/contracts/dist ./packages/contracts/dist
COPY --from=builder /app/packages/contracts/package.json ./packages/contracts/package.json
USER api
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 CMD node -e "fetch('http://localhost:3001/api/v1/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/api/dist/main.js"]
