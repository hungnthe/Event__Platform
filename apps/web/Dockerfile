FROM node:22.13.0-alpine AS base
# Node 22.13 ships an older Corepack signing keyring. Install the repository's
# pinned package manager directly so Docker builds remain reproducible.
RUN npm install --global pnpm@11.19.0
WORKDIR /app
FROM base AS builder
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/eslint-config/package.json packages/eslint-config/package.json
COPY apps/web apps/web
COPY packages/contracts packages/contracts
COPY packages/tsconfig packages/tsconfig
COPY packages/eslint-config packages/eslint-config
RUN pnpm install --frozen-lockfile --prod=false
ENV NEXT_OUTPUT_STANDALONE=true
RUN pnpm --filter @eventflow/contracts build && pnpm --filter @eventflow/web build
FROM node:22.13.0-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup --system --gid 1001 eventflow && adduser --system --uid 1001 web
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
USER web
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 CMD node -e "fetch('http://localhost:3000').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/web/server.js"]
