# ============================================================================
#  Backend Dockerfile - Multi-stage build (Express + TypeScript)
# ============================================================================

# ---------- Stage 1: dependencias + compilación ----------
FROM node:20-alpine AS builder

WORKDIR /app

# Instala dependencias (incluyendo devDependencies para compilar TS).
COPY package*.json ./
RUN npm ci

# Copia el código fuente y compila a JavaScript.
COPY tsconfig.json ./
COPY src ./src
COPY assets ./assets
RUN npm run build


# ---------- Stage dev: hot-reload con ts-node-dev ----------
# El código fuente se monta como volumen en docker-compose.dev.yml; aquí solo
# preparamos las dependencias (incluidas las de desarrollo).
FROM node:20-alpine AS development

WORKDIR /app
ENV NODE_ENV=development

COPY package*.json ./
RUN npm ci

EXPOSE 4000
CMD ["npm", "run", "dev"]


# ---------- Stage 2: imagen de producción (ligera) ----------
FROM node:20-alpine AS production

ENV NODE_ENV=production
WORKDIR /app

# Solo dependencias de producción.
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copia los artefactos compilados desde el builder.
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/assets ./assets

# Crea el directorio de uploads (se monta como volumen en docker-compose).
RUN mkdir -p /app/uploads && \
    addgroup -S nodejs && adduser -S nodejs -G nodejs && \
    chown -R nodejs:nodejs /app
USER nodejs

EXPOSE 4000

# Healthcheck básico contra el endpoint de salud.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/api/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "dist/server.js"]
