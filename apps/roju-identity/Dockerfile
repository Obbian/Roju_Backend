# Build from the repo root: docker build -f apps/roju-identity/Dockerfile .
# (npm workspaces needs the root package.json/lockfile to resolve deps correctly.)

FROM node:20-slim AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/roju-identity/package.json apps/roju-identity/package.json
COPY apps/roju-ride/package.json apps/roju-ride/package.json
RUN npm ci

COPY apps/roju-identity apps/roju-identity
RUN npm run build -w apps/roju-identity

FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY apps/roju-identity/package.json apps/roju-identity/package.json
COPY apps/roju-ride/package.json apps/roju-ride/package.json
RUN npm ci --omit=dev

COPY --from=builder /app/apps/roju-identity/dist apps/roju-identity/dist

EXPOSE 3100
CMD ["node", "apps/roju-identity/dist/main.js"]
