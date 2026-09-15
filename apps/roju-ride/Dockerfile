# Build from the repo root: docker build -f apps/roju-ride/Dockerfile .
# (npm workspaces needs the root package.json/lockfile to resolve deps correctly.)

FROM node:20-slim AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/roju-ride/package.json apps/roju-ride/package.json
COPY apps/roju-identity/package.json apps/roju-identity/package.json
RUN npm ci

COPY apps/roju-ride apps/roju-ride
RUN npm run build -w apps/roju-ride

FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY apps/roju-ride/package.json apps/roju-ride/package.json
COPY apps/roju-identity/package.json apps/roju-identity/package.json
RUN npm ci --omit=dev

COPY --from=builder /app/apps/roju-ride/dist apps/roju-ride/dist

EXPOSE 3000
CMD ["node", "apps/roju-ride/dist/main.js"]
